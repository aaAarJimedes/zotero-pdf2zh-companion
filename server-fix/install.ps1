param([Parameter(Mandatory=$true)][string]$ServerDirectory)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $ServerDirectory).Path
$target = Join-Path $root 'utils\execute.py'
$helper = Join-Path $root 'utils\companion_pipe_progress.py'
$text = [IO.File]::ReadAllText($target)
$old = '        _execute_with_inherit(final_cmd, final_env, task_id, cols)'
$new = @'
        if _windows_visible_console_size() is None:
            from utils.companion_pipe_progress import execute_pipe
            execute_pipe(final_cmd, final_env, task_id, cols)
        else:
            _execute_with_inherit(final_cmd, final_env, task_id, cols)
'@
if (-not $text.Contains('from utils.companion_pipe_progress import execute_pipe')) {
    if ([regex]::Matches($text, [regex]::Escape($old)).Count -ne 1) {
        throw 'Unsupported execute.py: expected exactly one Windows dispatch. No changes made.'
    }
    if (-not $text.Contains('def _windows_visible_console_size():')) {
        throw 'Unsupported execute.py: console detector missing. No changes made.'
    }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'companion_pipe_progress.py') -Destination $helper
    [IO.File]::WriteAllText($target, $text.Replace($old, $new), [Text.UTF8Encoding]::new($false))
} else {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'companion_pipe_progress.py') -Destination $helper
}
Write-Output 'Installed pipe progress fix. Restart the idle Server to activate it.'
