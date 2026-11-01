import React, { useState } from "react";
import { blocksForDay, newId, stamp, saveRoutineVersion } from "./model";
import { taskNames } from "./progress";

export default function RoutineVersions({
  plan,
  change,
  date,
  onBack,
  onApply,
}) {
  const [draft, setDraft] = useState(null),
    [error, setError] = useState("");
  const names = taskNames(plan);
  function start(copy) {
    setDraft({
      id: newId(),
      name: "",
      blocks: copy
        ? blocksForDay(plan, date).map((b) => ({
            id: b.id,
            name: b.name,
            start: b.start,
            duration: b.duration,
            updatedAt: stamp(),
          }))
        : [],
      updatedAt: stamp(),
      deleted: false,
    });
    setError("");
  }
  function save(event) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.blocks.length) {
      setError("Name this version and add at least one block.");
      return;
    }
    const record = {
      ...draft,
      name: draft.name.trim(),
      blocks: draft.blocks.map((b) => ({
        ...b,
        name: b.name.trim(),
        duration: Number(b.duration),
        updatedAt: stamp(),
      })),
      updatedAt: stamp(),
    };
    change((p) => saveRoutineVersion(p, record));
    setDraft(null);
  }
  function editBlock(id, values) {
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...values } : b)),
    }));
  }
  return (
    <>
      <button className="text-button" onClick={onBack}>
        Back to Account
      </button>
      <div className="page-heading">
        <div>
          <h1>Routine versions</h1>
          <p>Your usual week, with room for class days and changes.</p>
        </div>
      </div>
      <p className="fine-print">
        Your weekly blocks repeat automatically. Save alternative day plans
        here, then switch today’s plan with its small selector. Switching keeps
        completed work.
      </p>
      {!draft && (
        <>
          <div className="button-row">
            <button className="primary" onClick={() => start(true)}>
              Save this day as a version
            </button>
            <button className="secondary" onClick={() => start(false)}>
              Create empty version
            </button>
          </div>
          <div className="version-list">
            {Object.values(plan.templates || {})
              .filter((t) => !t.deleted)
              .map((t) => (
                <section className="settings-section" key={t.id}>
                  <h2>{t.name}</h2>
                  <p>
                    {t.blocks.length} blocks ·{" "}
                    {t.blocks.reduce((sum, b) => sum + b.duration, 0)} planned
                    minutes
                  </p>
                  <div className="button-row">
                    <button className="secondary" onClick={() => onApply(t.id)}>
                      Use for selected day
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setDraft({
                          ...t,
                          blocks: t.blocks.map((b) => ({ ...b })),
                        });
                        setError("");
                      }}
                    >
                      Edit version
                    </button>
                    <button
                      className="danger-text"
                      onClick={() =>
                        change((p) => ({
                          ...p,
                          templates: {
                            ...p.templates,
                            [t.id]: { ...t, deleted: true, updatedAt: stamp() },
                          },
                        }))
                      }
                    >
                      Archive version
                    </button>
                  </div>
                </section>
              ))}
          </div>
        </>
      )}
      {draft && (
        <form className="block-editor" onSubmit={save}>
          <label>
            Version name
            <input
              required
              maxLength={80}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Class day, half-day class…"
            />
          </label>
          {draft.blocks.map((b, i) => (
            <div className="version-block" key={b.id}>
              <label>
                Task
                <input
                  required
                  list="version-task-names"
                  maxLength={120}
                  value={b.name}
                  onChange={(e) => editBlock(b.id, { name: e.target.value })}
                />
              </label>
              <div className="form-columns">
                <label>
                  Start time
                  <input
                    type="time"
                    value={b.start}
                    onChange={(e) => editBlock(b.id, { start: e.target.value })}
                  />
                </label>
                <label>
                  Minutes
                  <input
                    required
                    type="number"
                    min="1"
                    max="1440"
                    value={b.duration}
                    onChange={(e) =>
                      editBlock(b.id, { duration: e.target.value })
                    }
                  />
                </label>
              </div>
              <button
                className="danger-text"
                type="button"
                aria-label={`Remove version block ${i + 1}`}
                onClick={() =>
                  setDraft({
                    ...draft,
                    blocks: draft.blocks.filter((row) => row.id !== b.id),
                  })
                }
              >
                Remove block
              </button>
            </div>
          ))}
          <datalist id="version-task-names">
            {names.map(([key, name]) => (
              <option key={key} value={name} />
            ))}
          </datalist>
          <button
            className="secondary"
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                blocks: [
                  ...draft.blocks,
                  {
                    id: newId(),
                    name: "",
                    start: "",
                    duration: 30,
                    updatedAt: stamp(),
                  },
                ],
              })
            }
          >
            Add block to version
          </button>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <div className="editor-actions">
            <button className="primary" type="submit">
              Save version
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
}
