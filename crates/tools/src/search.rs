use std::{
    fs,
    path::{Path, PathBuf},
};

use globset::{Glob, GlobSet, GlobSetBuilder};
use ignore::WalkBuilder;
use napi::{Task, bindgen_prelude::*};
use napi_derive::napi;
use regex::RegexBuilder;

const DEFAULT_LIMIT: u32 = 100;
const MAX_LIMIT: u32 = 1_000;
const DEFAULT_MAX_FILE_BYTES: u32 = 5 * 1024 * 1024;
const MAX_FILE_BYTES: u32 = 50 * 1024 * 1024;

#[napi(object)]
pub struct AllowedRoot {
    pub path: String,
    pub recursive: bool,
}

#[napi(object)]
pub struct EntitySearchRequest {
    pub base: String,
    pub query: String,
    pub allowed_roots: Vec<AllowedRoot>,
    pub entity_types: Option<Vec<String>>,
    pub match_mode: Option<String>,
    pub include_hidden: Option<bool>,
    pub max_depth: Option<u32>,
    pub limit: Option<u32>,
}

#[napi(object)]
pub struct EntityMatch {
    pub path: String,
    pub name: String,
    pub entity_type: String,
}

#[napi(object)]
pub struct EntitySearchResult {
    pub matches: Vec<EntityMatch>,
    pub truncated: bool,
}

#[napi(object)]
pub struct RegexpSearchRequest {
    pub base: String,
    pub target: Option<String>,
    pub pattern: String,
    pub allowed_roots: Vec<AllowedRoot>,
    pub mode: Option<String>,
    pub case_sensitive: Option<bool>,
    pub whole_word: Option<bool>,
    pub include: Option<Vec<String>>,
    pub exclude: Option<Vec<String>>,
    pub include_hidden: Option<bool>,
    pub max_file_bytes: Option<u32>,
    pub limit: Option<u32>,
}

#[napi(object)]
pub struct ContentMatch {
    pub path: String,
    pub line: u32,
    pub column: u32,
    pub text: String,
}

#[napi(object)]
pub struct RegexpSearchResult {
    pub matches: Vec<ContentMatch>,
    pub truncated: bool,
    pub scanned_files: u32,
}

pub struct EntitySearchTask(EntitySearchRequest);
pub struct RegexpSearchTask(RegexpSearchRequest);

#[napi]
pub fn entity_search(request: EntitySearchRequest) -> AsyncTask<EntitySearchTask> {
    AsyncTask::new(EntitySearchTask(request))
}

#[napi]
pub fn regexp_search(request: RegexpSearchRequest) -> AsyncTask<RegexpSearchTask> {
    AsyncTask::new(RegexpSearchTask(request))
}

impl Task for EntitySearchTask {
    type Output = EntitySearchResult;
    type JsValue = EntitySearchResult;
    fn compute(&mut self) -> Result<Self::Output> {
        search_entities(&self.0)
    }
    fn resolve(&mut self, _: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

impl Task for RegexpSearchTask {
    type Output = RegexpSearchResult;
    type JsValue = RegexpSearchResult;
    fn compute(&mut self) -> Result<Self::Output> {
        search_content(&self.0)
    }
    fn resolve(&mut self, _: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

fn search_entities(request: &EntitySearchRequest) -> Result<EntitySearchResult> {
    let (base, recursive) = authorize_path(&request.base, &request.allowed_roots)?;
    if !base.is_dir() {
        return Err(Error::from_reason("Base должен указывать на директорию"));
    }
    let query = request.query.trim();
    if query.is_empty() {
        return Err(Error::from_reason("Поисковый запрос пуст"));
    }
    let mode = request.match_mode.as_deref().unwrap_or("contains");
    let glob = if mode == "glob" {
        Some(Glob::new(query).map_err(invalid_pattern)?.compile_matcher())
    } else {
        None
    };
    let types = request.entity_types.as_deref().unwrap_or(&[]);
    let wants_files = types.is_empty() || types.iter().any(|item| item == "file");
    let wants_directories = types.is_empty() || types.iter().any(|item| item == "directory");
    let limit = request.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT) as usize;
    let query_lower = query.to_lowercase();
    let mut matches = Vec::new();
    let mut truncated = false;
    let mut builder = WalkBuilder::new(&base);
    builder
        .hidden(!request.include_hidden.unwrap_or(false))
        .follow_links(false)
        .max_depth(Some(if recursive {
            request
                .max_depth
                .map(|value| value as usize)
                .unwrap_or(usize::MAX)
        } else {
            1
        }));
    for entry in builder.build().filter_map(std::result::Result::ok).skip(1) {
        let Some(file_type) = entry.file_type() else {
            continue;
        };
        if (file_type.is_file() && !wants_files) || (file_type.is_dir() && !wants_directories) {
            continue;
        }
        if !file_type.is_file() && !file_type.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy();
        let relative = relative_path(&base, entry.path());
        let matched = match mode {
            "exact" => name.eq_ignore_ascii_case(query),
            "glob" => glob
                .as_ref()
                .is_some_and(|matcher| matcher.is_match(&relative)),
            "contains" => name.to_lowercase().contains(&query_lower),
            _ => return Err(Error::from_reason("Неизвестный режим поиска сущностей")),
        };
        if !matched {
            continue;
        }
        if matches.len() == limit {
            truncated = true;
            break;
        }
        matches.push(EntityMatch {
            path: relative,
            name: name.into_owned(),
            entity_type: if file_type.is_dir() {
                "directory"
            } else {
                "file"
            }
            .into(),
        });
    }
    Ok(EntitySearchResult { matches, truncated })
}

fn search_content(request: &RegexpSearchRequest) -> Result<RegexpSearchResult> {
    let (base, base_recursive) = authorize_path(&request.base, &request.allowed_roots)?;
    let target = match request
        .target
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(value) => authorize_candidate(&base.join(value), &request.allowed_roots)?.0,
        None => base.clone(),
    };
    let pattern = request.pattern.trim();
    if pattern.is_empty() {
        return Err(Error::from_reason("Шаблон поиска пуст"));
    }
    let source = match request.mode.as_deref().unwrap_or("regex") {
        "regex" => pattern.to_owned(),
        "literal" => regex::escape(pattern),
        _ => {
            return Err(Error::from_reason(
                "Неизвестный режим поиска по содержимому",
            ));
        }
    };
    let source = if request.whole_word.unwrap_or(false) {
        format!(r"\b(?:{source})\b")
    } else {
        source
    };
    let regex = RegexBuilder::new(&source)
        .case_insensitive(!request.case_sensitive.unwrap_or(false))
        .build()
        .map_err(invalid_pattern)?;
    let include = build_globs(request.include.as_deref().unwrap_or(&[]))?;
    let exclude = build_globs(request.exclude.as_deref().unwrap_or(&[]))?;
    let limit = request.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT) as usize;
    let max_file_bytes = request
        .max_file_bytes
        .unwrap_or(DEFAULT_MAX_FILE_BYTES)
        .clamp(1, MAX_FILE_BYTES) as u64;
    let mut files = Vec::new();
    if target.is_file() {
        files.push(target);
    } else if target.is_dir() {
        let mut builder = WalkBuilder::new(&target);
        builder
            .hidden(!request.include_hidden.unwrap_or(false))
            .follow_links(false)
            .max_depth((!base_recursive).then_some(1));
        files.extend(
            builder
                .build()
                .filter_map(std::result::Result::ok)
                .filter(|entry| entry.file_type().is_some_and(|kind| kind.is_file()))
                .map(|entry| entry.into_path()),
        );
    } else {
        return Err(Error::from_reason(
            "Цель поиска не является файлом или директорией",
        ));
    }
    let mut matches = Vec::new();
    let mut scanned_files = 0;
    let mut truncated = false;
    'files: for file in files {
        let relative = relative_path(&base, &file);
        if include.as_ref().is_some_and(|set| !set.is_match(&relative))
            || exclude.as_ref().is_some_and(|set| set.is_match(&relative))
        {
            continue;
        }
        let metadata = match fs::metadata(&file) {
            Ok(value) if value.len() <= max_file_bytes => value,
            _ => continue,
        };
        if !metadata.is_file() {
            continue;
        }
        let bytes = match fs::read(&file) {
            Ok(value) if !value.contains(&0) => value,
            _ => continue,
        };
        scanned_files += 1;
        let content = String::from_utf8_lossy(&bytes);
        for (line_index, line) in content.lines().enumerate() {
            for found in regex.find_iter(line) {
                if matches.len() == limit {
                    truncated = true;
                    break 'files;
                }
                matches.push(ContentMatch {
                    path: relative.clone(),
                    line: (line_index + 1) as u32,
                    column: (line[..found.start()].chars().count() + 1) as u32,
                    text: line.to_owned(),
                });
            }
        }
    }
    Ok(RegexpSearchResult {
        matches,
        truncated,
        scanned_files,
    })
}

fn authorize_path(path: &str, roots: &[AllowedRoot]) -> Result<(PathBuf, bool)> {
    authorize_candidate(Path::new(path), roots)
}

fn authorize_candidate(path: &Path, roots: &[AllowedRoot]) -> Result<(PathBuf, bool)> {
    let candidate = fs::canonicalize(path)
        .map_err(|error| Error::from_reason(format!("Не удалось открыть путь: {error}")))?;
    let grant = roots.iter().find_map(|grant| {
        fs::canonicalize(&grant.path).ok().and_then(|root| {
            (candidate == root || (grant.recursive && path_is_within(&candidate, &root)))
                .then_some(grant.recursive)
        })
    });
    let Some(recursive) = grant else {
        return Err(Error::from_reason("Путь не разрешён политикой агента"));
    };
    Ok((candidate, recursive))
}

#[cfg(windows)]
fn path_is_within(candidate: &Path, root: &Path) -> bool {
    let candidate = candidate.to_string_lossy().to_lowercase();
    let mut root = root.to_string_lossy().to_lowercase();
    while root.ends_with(['\\', '/']) {
        root.pop();
    }
    candidate == root || candidate.starts_with(&format!("{root}\\"))
}

#[cfg(not(windows))]
fn path_is_within(candidate: &Path, root: &Path) -> bool {
    candidate.starts_with(root)
}

fn build_globs(patterns: &[String]) -> Result<Option<GlobSet>> {
    if patterns.is_empty() {
        return Ok(None);
    }
    let mut builder = GlobSetBuilder::new();
    for pattern in patterns {
        builder.add(Glob::new(pattern).map_err(invalid_pattern)?);
    }
    builder.build().map(Some).map_err(invalid_pattern)
}

fn relative_path(base: &Path, path: &Path) -> String {
    path.strip_prefix(base)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn invalid_pattern(error: impl std::fmt::Display) -> Error {
    Error::from_reason(format!("Некорректный шаблон: {error}"))
}
