---
mode: testing
url: http://localhost:4931/
max_steps: 50
---

# First run

## Create the administrator
Verify "Create your account" is shown with the note that the first account becomes the administrator.
Type "alex@example.com" as the Email, and "Plan-Test-2026" as both the Password and the Confirm password, then click "Create account".
Verify "No team yet" is shown.

## Create a team
Click "Create team".
Type "Morgan Labs" as the Team name and verify the URL field shows "morgan-labs".
Click "Create team" in the dialog.
Verify "No projects yet" is shown.

## Create a project
Click "Create project".
Type "Website Launch" as the Name and verify the Key shows "WL".
Click "Create project" in the dialog.
Click "Got it" on the "What's new" panel.
Verify the board shows the Backlog, Todo, In Progress, Done and Canceled columns.
