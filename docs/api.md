# API

Interactive documentation is available from FastAPI at `/docs` while the service is running.

Authentication: `POST /auth/register` returns `{"api_key": "af_..."}`. Send it as `Authorization: Bearer <api_key>` on every route except `/health`, `/auth/register` and the dashboard. All data is scoped to that key's user. `DELETE /auth/account` removes the account and its data.

Key routes: `GET /health`, `GET|PUT /profile`, CRUD routes for `/education`, `/experience`, `/projects`, `/skills`, and `/answers`; `POST /cv/upload` and `GET /cv` for uploading and restoring the saved CV preview; `POST /fields/classify`; `POST /context`; `POST /answers/generate`; `POST /answers/validate`; `POST /answers/save`; and `POST /settings/delete-all-data` with an explicit confirmation body.

## Field payload

`FieldIn` fields sent by `extension/content.js`:

| key | purpose |
| --- | --- |
| `id` | handle used to write the value back to the element |
| `tag`, `type` | element kind; `contenteditable` and `radio-group` are synthesised |
| `name`, `id_attribute` | control identifiers, stripped of framework noise before matching |
| `label`, `question_hint`, `placeholder`, `aria_label` | short self-description, in priority order |
| `section` | enclosing fieldset legend or section heading |
| `nearby_text` | trimmed row text, used only as a low-confidence fallback |
| `question` | the full prompt found above an open-ended field |
| `autocomplete` | HTML `autocomplete` token, mapped first |
| `options`, `option_values` | real choices, aligned by index |
| `required`, `visible`, `current_value`, `maxlength` | control state |

## Classification response

`POST /fields/classify` returns one entry per field with `mapped_field`, `confidence`, `source` (`autocomplete`, `hint`, `type`, `rule`, `ml`, `context`), `value`, `option_value` and `requires_review`. Open-ended entries instead return `kind: "open_ended"` with the extracted `question`.

## Answer generation

`POST /answers/generate` takes `{"question": "...", "length": "concise|standard|detailed"}` and returns `answer`, `confidence`, `relevance`, `first_person`, `question_kind`, `sources`, `missing`, `valid` and `validation_message`. `sources` lists the evidence blocks used, `missing` lists what the profile does not record, and `validation_message` explains any grounding or voice problem. `POST /context` returns the same evidence without calling the model.
