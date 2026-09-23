# End-to-end flows (Maestro)

Flows for the Linewise Android app, written for [Maestro](https://maestro.mobile.dev). They find things
through the `testID`s in the source, and use English text in a few `assertVisible` checks, so run them on
a phone or emulator set to English.

| Flow | Covers |
| --- | --- |
| `01-onboarding.yaml` | first-launch questions, the First Letter demo, saving the sample poem |
| `02-add-text.yaml` | add a text, chunk preview, search, delete |
| `03-games.yaml` | opens all 11 games; plays the scored ones to the result screen |
| `04-review-day.yaml` | a new text is due, a perfect scored game advances the plan, a second game is practice only |
| `05-backup-restore.yaml` | back up, then merge a known backup file |
| `06-folders.yaml` | make a folder, put a text in it, search, move the text out, delete the folder |

`_setup.yaml` and `_add-poem.yaml` are helpers the other flows call.

## Run

1. Build and install a release APK (`npx expo prebuild --platform android`, then
   `cd android && ./gradlew assembleRelease`, then `adb install`) on an English emulator or phone.
2. For the restore flow, copy the fixture to the phone:
   `adb push e2e/fixtures/linewise-backup-test.json /sdcard/Download/`
3. `maestro test e2e/` runs everything, or run one file, for example `maestro test e2e/04-review-day.yaml`.

## Known limits

- Speak and Run Scene only check that the screen opens. Reciting needs a microphone and an on-device
  speech pack, which emulators do not have.
- Listen only checks that the screen opens, so the flows never depend on a text-to-speech voice.
- The restore flow drives the system file picker, whose layout differs between Android versions. Adjust the
  `tapOn` steps if your picker looks different.
- These flows have been checked for valid YAML and for the `testID`s they use, but have not been run
  against a device yet (none was available while writing them).
