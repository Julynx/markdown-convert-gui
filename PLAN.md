# markdown-convert-gui — Plan

An Electron desktop app (Windows) that wraps the [`markdown-convert`](https://github.com/Julynx/markdown_convert) Python package (`pip`/`uv` package that converts Markdown files to PDF) with a drag-and-drop GUI.

## Screens

### 1. Requirements screen

- The app should check requirements at startup.
- Only visible if any of the requirements is not found.
- Requirements
  - UV (which manages Python versions itself, so no system-level Python is needed)
  - markdown-convert Python package
- Structure:
  - Text: "You seem to be missing a few required dependencies.\nClick the button below to install them".
  - Wide rectangular cards featuring a logo, the name of the dependency and a short description (left aligned) as well as the status of installation (right aligned.).
    - Cards are green or red depending on if they were found or not.
  - A wide blue button with the text "Install requirements"
- Functionality:
  - Clicking "Install requirements" sets flag to install and installs only the first not found requirement, then reboots the app and proceeds with the next. The reboot ensure all required PATH and environment variables are set after installation.
  - The installation log is kept and shown only in case of error.
  - If any elevation is needed, the appropriate os popup to grant admin priviledges is shown.

#### Install commands

| Requirement      | Command                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| UV               | `winget install --id astral-sh.uv -e --accept-package-agreements --accept-source-agreements`                                           |
| markdown-convert | `uv tool install markdown-convert` then `uv tool update-shell` (ensures `~/.local/bin` on PATH — same step, not a chained requirement) |

### 2. markdown-convert update screen

- An update check for markdown-convert runs at every app startup.
- Only shown if:
  1. markdown-convert is installed
  2. There is an update available for the markdown-convert package.
- Not interactive. If there is an update, it is automatically installed, without confirmation.
- Design:
  - The text: "markdown-convert is out of date.\nUpdating, please wait..."
  - A large blue throbber, displayed while the update is being installed.
- This screen is entirely skipped if:
  - No updates were found.
  - The update check failed because of a lack of internet connection.

### 3. main screen

- Displays:
  - The text "Drag and drop a Markdown (.md) file to convert it to PDF." in a large font size.
  - A button below that the user can click to "Explore".
  - A small italics text position at the bottom of the window that says "You can also include a CSS file for styling."

#### Functionality

| Drop                                                                                                                             | Result                               |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `file.md`                                                                                                                        | convert with default CSS             |
| `file.md` + one `.css`                                                                                                           | convert with that CSS                |
| multiple `.md`, no css                                                                                                           | all converted with default CSS       |
| multiple `.md` + **one** `.css`                                                                                                  | all converted sharing that CSS       |
| `.md`/`.css` set where **every** md pairs with a same-named css (`file1.md`, `file1.css`, `file2.md`, `file2.css`)               | each pair converted separately       |
| any non-md/non-css file (`file.anything`)                                                                                        | **error** naming the offending files |
| css files only, no `.md` (`file.css`)                                                                                            | **error**                            |
| multiple css with any unpaired file (`file1.md, fileA.css, file2.md, fileB.css`; also strict partial pairing, e.g. 3 md + 2 css) | **error**                            |

#### Conversion

- The converted pdf file is temporarily saved to a temporary folder of the OS.
- After each conversion, display the "Save as" dialogue and move (not copy) the file to the destination selected by the user in that dialogue.

#### Save as dialogue

- Use the OS folder-picker dialog to save the file as pdf.
  - The default name for the output file is the same as the input markdown file, but with the .pdf extension
  - Re-show the window if there are multiple files
  - On submit, move the output pdf file from the temp folder to the selected destination.

## Error Handling Strategy

- Install failure → show captured command output.
- Conversion failure → show captured command output, stop batch, clean temp.
- Invalid drop combination → show error message naming offending files and explaining valid combinations.
- Update check failure → silent (console only).
- Update install failure → show captured command output.
- All long-running operations: show a spinner/throbber.

## Style guide

- No gradients, shadows, textures or backgrounds.
- Instead: Leverage white space for a clean design, centered text alignment, 2px thick borders, consistent border radius, a limited (3-4 colors) color palette, use hierachy via bold/regular/thin weights and font size, stick to sans serif fonts like Inter, load local resources instead of cdn when possible, use local static css instead of css libraries when possible, comfortable margins and paddings, consistent alignment, intuitive UI/UX, good design practices.
- Inspect the "sketches/" folder and use it as reference.
- When in doubt, ask.

## Coding practices

Follow good coding practices, including but not limited to:

  1. Write **descriptive variable names** and file names. Follow a tidy folder structure.
  2. Write **docstrings** for every module, function or class.
  3. **Avoid inline comments.** If you find yourself using them, delete them and improve compliance with rules 1 and 2 instead.
  4. Follow **modularization**. Minimize coupling and make dependencies explicit. Avoid hidden global state, implicit dependencies, and unnecessary dependencies between modules. Prefer dependency injection or clearly defined interfaces, and keep dependency direction deliberate.
  5. Reusability: **Don't repeat yourself**.
  6. Be **idiomatic**. Leverage the native features offered by the programming language.
  7. Don't reinvent the wheel. Use **well established libraries** for complex tasks instead of writing your own implementation.
  8. Use both logging to file and **loud error handling**. Errors should be caught, and their traces visible to the user, even in production (unless explicitly ignored).
  9. **No inline resources**. All assets and configuration should live on separate files with the appropriate file extension, collected inside an assets/config folder, and loaded at runtime. Source files should only contain logic, not configuration or assets.
  10. Concise and precise English for buttons and user-facing application text. Follow established conventions for language and copy text. Use **Orwell's rules for concise English** to avoid fluff.
