# Local Task Board

This directory is used when orchestration task storage mode is `local_files`.

## Status Folders

- `pending/`: tasks waiting to be started.
- `in_progress/`: tasks currently being executed.
- `completed/`: finished tasks.

## Notes

- Keep one task per file.
- Task status must match the folder where the file resides.
- Use consistent task IDs from orchestration policy.
- Use canonical task shape from `../../templates/task-template.yaml`.
