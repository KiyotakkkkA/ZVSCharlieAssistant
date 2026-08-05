---
name: "managed-powershell"
description: "Runs permitted PowerShell commands through cmd_exec for local system inspection, file operations, diagnostics, and long-running terminal tasks while respecting confirmation and directory policies."
---

# Managed PowerShell execution

Use `cmd_exec` only when the user asks for information or an action that requires access to the local computer. Prefer one focused command over several exploratory calls. Do not discuss or guess the tool signature: call it using one of the exact shapes below.

## Fast path for ordinary commands

For commands expected to finish quickly, make one foreground call:

```json
{
  "action": "start",
  "script": "Get-ComputerInfo",
  "purpose": "Read operating system and hardware information",
  "execution": "foreground"
}
```

`action`, `script`, and `purpose` are required when starting a command. `execution` is optional and defaults to `foreground`. There is no `background` action: background execution is selected with `"execution": "background"` while `action` remains `"start"`.

After a foreground call returns, interpret `stdout`, `stderr`, `status`, and `exitCode`. Do not call `status`, `output`, or `wait` for a foreground command unless the returned result explicitly indicates that the session is still running.

## Start input

Use this shape only to create a terminal session:

```json
{
  "action": "start",
  "script": "PowerShell command or pipeline",
  "purpose": "Short user-facing explanation of why this command is needed",
  "cwd": "C:\\absolute\\allowed\\directory",
  "execution": "foreground",
  "timeoutSeconds": 60
}
```

- `script`: provide the PowerShell source as a single string.
- `purpose`: explain the intended result, not the implementation details.
- `cwd`: use an absolute allowed directory. Omit it only when the configured default directory is appropriate.
- `execution`: use `foreground` for quick operations and `background` only for genuinely long-running work.
- `timeoutSeconds`: request only the time reasonably needed; the effective policy may lower it.

Never send `sessionId` with `action: "start"`.

## Background lifecycle

Start long work once:

```json
{
  "action": "start",
  "script": "Get-ChildItem -Recurse",
  "purpose": "Enumerate project files for analysis",
  "cwd": "C:\\Projects\\Example",
  "execution": "background",
  "timeoutSeconds": 120
}
```

Save the returned `sessionId`. Use that exact identifier in subsequent calls. Do not start the same command again to check its progress.

Check state without waiting:

```json
{
  "action": "status",
  "sessionId": "00000000-0000-0000-0000-000000000000"
}
```

Read accumulated output:

```json
{
  "action": "output",
  "sessionId": "00000000-0000-0000-0000-000000000000"
}
```

Wait briefly for completion:

```json
{
  "action": "wait",
  "sessionId": "00000000-0000-0000-0000-000000000000",
  "timeoutSeconds": 30
}
```

Cancel only when the user requests cancellation or continued execution is no longer useful:

```json
{
  "action": "cancel",
  "sessionId": "00000000-0000-0000-0000-000000000000"
}
```

For `status`, `output`, `wait`, and `cancel`, provide `sessionId` and do not provide `script`, `purpose`, `cwd`, or `execution`.

## Common workflows

### Inspect hardware

Use a single read-only command and summarize the useful fields instead of returning an unfiltered dump:

```json
{
  "action": "start",
  "script": "Get-ComputerInfo",
  "purpose": "Read CPU, memory, operating system, and computer information",
  "execution": "foreground"
}
```

If `Get-ComputerInfo` is not permitted by policy, report that limitation. Do not repeatedly try aliases, WMI, CIM, external executables, or encoded commands to bypass the policy.

### List files

```json
{
  "action": "start",
  "script": "Get-ChildItem",
  "purpose": "List files in the requested project directory",
  "cwd": "C:\\Projects\\Example",
  "execution": "foreground"
}
```

### Read a text file

```json
{
  "action": "start",
  "script": "Get-Content .\\README.md",
  "purpose": "Read the requested project documentation",
  "cwd": "C:\\Projects\\Example",
  "execution": "foreground"
}
```

### Search text

```json
{
  "action": "start",
  "script": "Get-ChildItem -Recurse -Filter *.ts | Select-String -Pattern TODO",
  "purpose": "Find TODO markers in TypeScript source files",
  "cwd": "C:\\Projects\\Example",
  "execution": "foreground"
}
```

### Create or update a file

Use mutating commands only when the user requested a change. Expect a confirmation request when required by policy.

```json
{
  "action": "start",
  "script": "Set-Content .\\status.txt -Value Ready",
  "purpose": "Update the requested project status file",
  "cwd": "C:\\Projects\\Example",
  "execution": "foreground"
}
```

## Policy and confirmation rules

The effective policy controls allowed commands, directories, permissions, network access, concurrency, timeout, and output size. Agent settings may narrow that policy but cannot expand it.

- Treat a pending confirmation as normal. Do not submit duplicate calls while waiting for the user.
- Use read-only commands when they satisfy the request.
- Use only directories relevant to the request.
- Do not attempt privilege escalation, policy modification, registry access, encoded commands, dynamic execution, or a different executable to evade a denial.
- Do not use variables, script blocks, `Invoke-Expression`, `Start-Process`, `Add-Type`, `New-Object`, or other constructs rejected by the managed executor.
- If a command is denied, explain which command, path, or permission must be enabled. Stop unless a clearly different permitted approach satisfies the same request.

## Response rules

After success, answer the user's actual question using the command output. Include raw terminal output only when it is useful or requested. State uncertainty when output is incomplete. Never claim an operation succeeded unless the tool returned a successful terminal status.
