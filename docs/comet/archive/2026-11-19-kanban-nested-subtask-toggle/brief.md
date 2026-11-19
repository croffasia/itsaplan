# Outcome

Show two levels of subtasks inside a Kanban card by default. The progress count next to a subtask's title expands or collapses its children. The title opens the subtask's details.

# Scope

## Directory structure

### Modified

- `apps/web/src/features/work-items/components/kanban/`: show and fold the children of a subtask row inside a card.
- `apps/web/src/features/work-items/components/shared/SubtaskProgress.tsx`: expose the expanded state of the existing progress button.

### Created

- `apps/web/src/features/work-items/components/kanban/IssueCardSubtasks.test.tsx`: verify default folding, independent branches, and detail navigation.

# Non-goals

- Table and timeline layouts, progress calculation, and stored project or view settings.

# Acceptance examples

- With the Kanban subtask list enabled and Default collapsed off, WEEKUP-1's card shows WEEKUP-2 and WEEKUP-3 and their direct children by default. With Default collapsed on, the card's subtask list starts folded. After opening the card's subtask list, the children of WEEKUP-2 and WEEKUP-3 are folded until opened. Changing Default collapsed updates these initial states.
- Activating the progress count by pointer or keyboard folds or unfolds that row's own children without affecting its siblings. Levels deeper than the two shown by default start folded and use the same control when a count is displayed. A row with no progress count has no expand button.
- Clicking the title of a subtask or a displayed descendant opens that issue's details. Activating the progress button toggles its branch without opening an issue, selecting the card, or starting a drag.
