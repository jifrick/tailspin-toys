export interface DevBriefExample {
  id: string;
  label: string;
  issue: string;
}

export const DEVBRIEF_EXAMPLES: DevBriefExample[] = [
  {
    id: 'search-filter',
    label: 'Search filters',
    issue: `## Problem
The game search filter resets when I open a game and use the browser back button.

## Context
Happens in Chrome on desktop after filtering the games list by category.

## Expected Behavior
The selected category and matching results should still be visible when returning to the list.

## Current Behavior
The category selector resets to "All games" and the full list is shown.

## Requirements
Preserve the selected filter in the URL so the view can be shared.

## Edge Cases
The category may no longer exist if the list changes while the page is open.`,
  },
  {
    id: 'keyboard-dialog',
    label: 'Keyboard dialog',
    issue: `A confirmation dialog cannot be dismissed with the Escape key.

Current behavior: keyboard users have to tab to the close button.
Expected behavior: Escape closes the dialog and returns focus to the button that opened it.

Context: reproduced with Chrome and Firefox using only the keyboard.
Requirements: do not close the dialog while a save operation is in progress.
Edge case: focus should not be lost if the original trigger is removed.`,
  },
  {
    id: 'api-validation',
    label: 'API validation',
    issue: `## Problem
Creating a project with a whitespace-only name succeeds, then the project page renders without a title.

## Context
POST /api/projects accepts the name field from the create-project form.

## Expected Behavior
Trim the name and return a clear validation error when it is empty.

## Current Behavior
The project is stored with an empty name and the client displays a blank heading.

## Requirements
Keep the existing response format and do not write invalid projects to the database.

## Technical Considerations
Validation belongs at the API boundary; the database also enforces a non-empty value.

## Acceptance Criteria
Given a whitespace-only name, when the request is submitted, then the API returns a validation error and creates no project.`,
  },
];
