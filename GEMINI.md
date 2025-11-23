# AI Assistant File Change Workflow

To ensure clarity, safety, and control over actions made by an AI assistant, the following workflow must be followed for any proposed modification to the codebase or when reading files.

## 1. Plan

Before making any changes, the AI assistant must present a clear and concise plan. This plan must include the following details:

*   **What to change:** A specific description of the files and code sections that will be modified. this also included the absolute path of the file.
*   **Purpose:** A clear explanation of the goal of the change (e.g., fixing a bug, adding a feature, improving performance).
*   **Risk:** An assessment of potential risks and side effects (e.g., breaking changes, performance degradation, security vulnerabilities).
*   **Why it's needed:** A justification for why the change is necessary or beneficial.
*   **What command need to run:** The list of specific linux command that need to run to make the change.

## 2. Approval

The user will review the plan. The AI assistant must wait for explicit approval from the user before proceeding with the implementation.

## 3. Execute

Once the plan is approved, the workflow can follow the usual AI practice, which AI assistant ask again about the change with the usual choice of Yes and editing, and after that AI assistant can proceed with executing the changes as described in the plan.

# File Reading Workflow

To ensure clarity and control over file reading actions, the following workflow must be followed:

## 1. Plan

Before reading any files, the AI assistant must present a clear and concise plan. This plan must include the following details:

*   **Files to read:** A specific description of the files to be read, including their absolute paths.
*   **Purpose:** A clear explanation of the goal of reading these files.
*   **Why it's needed:** A justification for why reading these files is necessary or beneficial.

## 2. Approval

The user will review the plan. The AI assistant must wait for explicit approval from the user before proceeding with reading the files.

## 3. Execute

Once the plan is approved, the AI assistant can proceed with reading the specified files. -->

# Command Execution Workflow

For any command that needs to be run in terminal. Even tho it's just a ls command, AI Assistant must first ask for permission and provide the following details:

* **The Command:** The exact command to be run.
* **Explanation:** A clear description of what the command does.
* **Why it's needed:** The specific reason this command is required to complete the current task.
* **What will be affected:** Any files, directories, or system states that will be created, modified, or deleted.

