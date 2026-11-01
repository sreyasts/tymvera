import React, { useState } from "react";
import { blocksForDay, newId, stamp, saveRoutineVersion, WEIGHTS, taskWeight, renameTask, blockEnd } from "./model";
import { taskNames } from "./progress";
import {useBackLayer} from './navigation';

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
  useBackLayer(!!draft,()=>setDraft(null));
  function start(copy) {
    setDraft({
      id: newId(),
      name: "",
      autoDays: [],
      blocks: copy
        ? blocksForDay(plan, date).map((b) => ({
            id: b.id,
            name: b.name,
            start: b.start,
            duration: b.duration,
            weight: taskWeight(b),
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
    change((p) => {
      let next=p;
      const old=p.templates?.[record.id];
      let saved=record;
      for (const b of record.blocks) {
        const previous=old?.blocks.find(row=>row.id===b.id);
        if (previous && previous.name !== b.name) {
          next=renameTask(next,previous.name,b.name);
          saved={...saved,blocks:saved.blocks.map(row=>row.name.trim().toLowerCase()===previous.name.trim().toLowerCase()?{...row,name:b.name}:row)};
        }
      }
      return saveRoutineVersion(next,saved);
    });
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
          <h1>Day presets</h1>
          <p>Automatic days, with room for real life.</p>
        </div>
      </div>
      <p className="fine-print">
        Assign days to each preset for automatic switching at midnight. The most recently saved preset wins if days overlap. Today’s selector overrides one date only; tomorrow returns to automatic. Completed work stays recorded.
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
                    {(t.autoDays || []).map(d=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(", ") || "Manual only"} · {t.blocks.length} blocks ·{" "}
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
                        change((p) => saveRoutineVersion(p,{...t,deleted:true,autoDays:[],updatedAt:stamp()}))
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
          <fieldset><legend>Use automatically on</legend><div className="repeat-days">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day,i)=><button key={day} type="button" aria-pressed={(draft.autoDays||[]).includes(i)} className={(draft.autoDays||[]).includes(i)?"active":""} onClick={()=>setDraft({...draft,autoDays:(draft.autoDays||[]).includes(i)?draft.autoDays.filter(d=>d!==i):[...(draft.autoDays||[]),i]})}>{day}</button>)}</div><p className="fine-print">Leave all days off for a manual preset. Past schedules and progress stay intact.</p></fieldset>
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
              <label>Priority<select value={taskWeight(b)} onChange={e=>editBlock(b.id,{weight:Number(e.target.value)})}>{WEIGHTS.map(([value,label])=><option key={value} value={value}>{label} · {value} point{value>1?"s":""}</option>)}</select></label>
              {b.start && <p className="fine-print">Ends {blockEnd(b).time}{blockEnd(b).nextDay ? " next day" : ""}.</p>}
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
                    weight: 2,
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
