use yaml_rust2::YamlLoader;

pub fn parse_charset(config: &str) -> Result<Vec<String>, String> {
    let documents = YamlLoader::load_from_str(config)
        .map_err(|error| format!("Не удалось разобрать конфигурацию модели: {error}"))?;
    let root = documents
        .first()
        .ok_or_else(|| "Конфигурация модели пуста".to_string())?;
    let entries = root["PostProcess"]["character_dict"]
        .as_vec()
        .ok_or_else(|| "В конфигурации модели нет словаря символов".to_string())?;

    let mut charset = Vec::with_capacity(entries.len() + 2);
    charset.push(String::new());
    for entry in entries {
        let symbol = entry
            .as_str()
            .map(|value| value.to_string())
            .or_else(|| entry.as_i64().map(|value| value.to_string()))
            .or_else(|| entry.as_f64().map(|value| value.to_string()))
            .ok_or_else(|| "Словарь символов содержит нестроковое значение".to_string())?;
        charset.push(symbol);
    }
    charset.push(" ".to_string());
    Ok(charset)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_a_charset_with_blank_first_and_space_last() {
        let config = "PostProcess:\n  name: CTCLabelDecode\n  character_dict:\n  - 'a'\n  - 'б'\n  - '9'\n";
        let charset = parse_charset(config).expect("словарь разбирается");
        assert_eq!(charset.len(), 5);
        assert_eq!(charset[0], "");
        assert_eq!(charset[1], "a");
        assert_eq!(charset[2], "б");
        assert_eq!(charset[3], "9");
        assert_eq!(charset[4], " ");
    }

    #[test]
    fn accepts_unquoted_numeric_entries() {
        let config = "PostProcess:\n  character_dict:\n  - 0\n  - 1\n";
        let charset = parse_charset(config).expect("словарь разбирается");
        assert_eq!(charset[1], "0");
        assert_eq!(charset[2], "1");
    }

    #[test]
    fn rejects_a_configuration_without_a_dictionary() {
        let config = "PostProcess:\n  name: CTCLabelDecode\n";
        assert!(parse_charset(config).is_err());
    }
}
