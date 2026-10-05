# LevelMate release notes

Newest first. Plugin settings do not show this list; it lives here (and on the USB) for a details page if the plugin is ever shared.

## 1.5.2
- **No default hotkeys:** Move up, Move down, Fold and Unfold no longer come with keys, as Obsidian's guidelines ask, so they never clash with keys you already use. Set your own in Settings > Hotkeys (search "LevelMate"); Outliner users usually pick Ctrl+Shift+Up/Down and Ctrl+Up/Down. Tab and Shift+Tab work as before.
- **Review cleanups:** uses Obsidian's own helpers for creating elements and cross-window checks, and reads saved settings with a proper type. No change in behavior.

## 1.5.1
- **Plugin id is now `levelmate`:** it was `tabwise`. If you used an earlier build, rename `.obsidian/plugins/tabwise` to `.obsidian/plugins/levelmate` in your vault and your settings carry over.
- **Settings search:** every setting now shows up in Obsidian's settings search (needs Obsidian 1.13 or later).
- **Cleanups for the community directory:** no `!important` in the styles, a coffee link in the manifest, and signed (attested) releases.

## 1.4.2
- **Renamed to LevelMate:** the plugin's name, settings title and About text now say LevelMate. Saved settings carry over (the plugin id is unchanged).

## 1.4.1
- **Coffee link made generic:** the button still shows, but it now points to the plain buymeacoffee.com site (no user). The real link gets set later in one place, `coffeeButton.ts`.
- **Tip line left-aligned:** "If you enjoy this plugin, please consider a small tip..." now sits flush left in the settings header (the coffee button stays right).

## 1.4.0
- **Heading drag rules:** a `#` heading can only land between other `#` sections, never inside one, so it no longer adopts that section's `##` children. A `##` can leave its `#` and land among another `#`'s `##` headings, taking its own sub-headings with it. The same rule applies at every level.
- **File explorer lines setting removed:** the explorer's lines belong to FolderMate. LevelMate now only draws lines in notes. A saved value for the old setting is ignored.
- **Indentation lines setting:** renamed "LevelMate indentation lines" and explained: on swaps Obsidian's guides for LevelMate's, off brings Obsidian's back (to remove all lines, turn off Settings > Editor > Show indentation guides).

## 1.3.1
- **Settings header:** the line "If you enjoy this plugin, please consider a small tip, I would greatly appreciate it!" now sits above "Made with care" and the coffee button, so the header matches MindmapMate and FolderMate exactly.

## 1.3.0
- **Calmer drag start:** grabbing the grip lights nothing. A drop slot lights only once the pointer is close to it (within about a third of a line), so holding still or crossing the middle of a line does nothing. Same for headings: no more jump to the next heading.
- **Drop slots shown:** while dragging, every place the item can land shows as a faint line in the drop color; the one the pointer is near becomes the full drop bar. Only the visible part of the note is marked, and new slots appear as you scroll.
- **File explorer lines:** new toggle under Appearance to show or hide the vertical lines in Obsidian's file explorer.

## 1.2.0
- **Indentation lines:** turning LevelMate's lines on no longer switches off the file explorer's own lines; the override now applies to notes only.
- **Line anchors:** a line now hangs from the center of its item's bullet, number or checkbox and starts under the first line, so it runs beside every wrapped line of a long paragraph.
- **Drag and drop:** the drop bar now appears at the pointer, in the gap just above or below the line you are on, and the pointer's horizontal position picks the level (right = nested, left = outer). Before, dropping "after" an item with sub-items put the bar below its whole branch.
- **Grip setting:** turning Drag-and-drop off hides the grip at once, even if it was showing, and it can no longer be hit.

## 1.1.1
- **Grip stays in view:** found by a live check in Obsidian. In a narrow pane (sidebar open) the drag grip sat outside the editor, clipped and under the sidebar. It now stays inside the pane.
- **Grip returns after Esc:** after cancelling a drag, the grip showed again only once the pointer visited another line. It now comes back as soon as the pointer moves.
- **Indent line click:** Obsidian's fold arrow covered the top of a parent's vertical line, so a click there folded the child. The line's click area is now narrower and sits above the arrow.
- **No What's new in settings:** plugins keep release notes in this file instead.
- **Live check script:** `npm run obsidian:check` drives a real Obsidian with real key and mouse events (Tab, Enter, Ctrl+A, move and fold hotkeys, indent lines, drag and drop, settings).

## 1.1.0
- **Preferences:** about block with version and author, and a plain explanation under every setting.
- **Drag-and-drop:** only drop points that change something are shown (lists and headings alike).
- **Drag-and-drop:** the grabbing hand stays for the whole drag; the grip sits farther left.
- **Drag-and-drop:** the indicator is centered between lines, with a dot at the level the item lands on, and a faded copy of the dragged line follows the pointer.
- **Ordered lists:** renumbered after moving or dropping items.
- **Indent lines:** vertical indentation lines no longer double up with Obsidian's own.
