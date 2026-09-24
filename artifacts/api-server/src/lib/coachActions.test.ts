/**
 * The coach's action layer, tested on the parts that decide whether it really
 * does the work.
 *
 * There are two readers — one for the model's JSON, one for plain English — and
 * both must produce values the executor accepts. The cases below are the exact
 * sentences a student types; the assertions are about what would end up in their
 * task list, not about internal shape.
 */
import { describe, it, expect } from "vitest";
import { MAX_ACTIONS, parseActionsFromModel, parseActionsFromText } from "./coachActions";

const TODAY = "2026-09-24";

describe("parseActionsFromModel", () => {
  it("reads a reply and its actions out of the provider's JSON", () => {
    const raw = JSON.stringify({
      reply: "Added it and started your block.",
      actions: [
        { type: "create_task", title: "Revise thermodynamics", estimatedMinutes: 45, priority: "high" },
        { type: "start_session", minutes: 45, label: "Thermodynamics" },
      ],
    });
    const { reply, actions } = parseActionsFromModel(raw);
    expect(reply).toBe("Added it and started your block.");
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ type: "create_task", title: "Revise thermodynamics", estimatedMinutes: 45 });
  });

  it("tolerates the code fences and prose models wrap JSON in", () => {
    const raw = "Sure! Here is the JSON:\n```json\n{\"reply\":\"Done\",\"actions\":[{\"type\":\"create_goal\",\"title\":\"Finish the semester strong\"}]}\n```";
    const { reply, actions } = parseActionsFromModel(raw);
    expect(reply).toBe("Done");
    expect(actions).toEqual([{ type: "create_goal", title: "Finish the semester strong" }]);
  });

  it("treats unparsable output as an answer with no actions, never an error", () => {
    const { reply, actions } = parseActionsFromModel("Three blocks of 50 minutes. Start with the hardest topic.");
    expect(reply).toMatch(/Three blocks of 50 minutes/);
    expect(actions).toEqual([]);
  });

  it("drops invented action types instead of executing them", () => {
    const raw = JSON.stringify({
      reply: "ok",
      actions: [
        { type: "delete_account" },
        { type: "award_coins", amount: 100000 },
        { type: "create_task", title: "Real one" },
      ],
    });
    const { actions } = parseActionsFromModel(raw);
    expect(actions).toEqual([{ type: "create_task", title: "Real one" }]);
  });

  it("clamps values that are outside the product's bounds", () => {
    const raw = JSON.stringify({
      reply: "ok",
      actions: [
        { type: "create_task", title: "x".repeat(900) },
        { type: "create_task", title: "Four hour block", estimatedMinutes: 9000 },
        { type: "start_session", minutes: 900 },
        { type: "create_task", title: "Bad date", dueDate: "2026-02-30" },
      ],
    });
    const { actions } = parseActionsFromModel(raw);
    // The over-long title and the impossible date are rejected; the 9000-minute
    // estimate and the 900-minute session are out of range too.
    expect(actions).toEqual([]);
  });

  it("caps the number of actions a single message can perform", () => {
    const raw = JSON.stringify({
      reply: "ok",
      actions: Array.from({ length: 20 }, (_, i) => ({ type: "create_task", title: `Task ${i}` })),
    });
    expect(parseActionsFromModel(raw).actions).toHaveLength(MAX_ACTIONS);
  });

  it("keeps the valid actions when one of them is malformed", () => {
    const raw = JSON.stringify({
      reply: "ok",
      actions: [
        { type: "create_task", title: "" },
        { type: "create_task", title: "Keep me" },
        { type: "start_session", minutes: "twenty" },
      ],
    });
    expect(parseActionsFromModel(raw).actions).toEqual([{ type: "create_task", title: "Keep me" }]);
  });
});

describe("parseActionsFromText — the keyless path", () => {
  it("turns 'add task …' into a task, with the estimate and due date it was told", () => {
    const actions = parseActionsFromText("add task revise physics for 45 minutes tomorrow", TODAY);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "create_task",
      estimatedMinutes: 45,
      dueDate: "2026-09-25",
    });
    expect((actions[0] as { title: string }).title).toMatch(/revise physics/i);
  });

  it("understands 'remind me to …' and 'high priority'", () => {
    const actions = parseActionsFromText("remind me to submit the lab report high priority", TODAY);
    expect(actions[0]).toMatchObject({ type: "create_task", priority: "high" });
  });

  it("starts a session, and keeps the label separate from the task title", () => {
    const actions = parseActionsFromText("start a 50 minute focus session on organic chemistry", TODAY);
    expect(actions).toEqual([{ type: "start_session", minutes: 50, label: "organic chemistry" }]);
  });

  it("reads hours as minutes for a long block", () => {
    const actions = parseActionsFromText("start a 2 hour session", TODAY);
    expect(actions).toEqual([{ type: "start_session", minutes: 120, label: null }]);
  });

  it("defaults to the product's own block length when no duration is given", () => {
    const actions = parseActionsFromText("start a focus session", TODAY);
    expect(actions).toEqual([{ type: "start_session", minutes: 25, label: null }]);
  });

  it("creates a goal, and can do a task and a session in one sentence", () => {
    const goal = parseActionsFromText("create a goal to finish the semester strong by next week", TODAY);
    expect(goal[0]).toMatchObject({ type: "create_goal" });

    const both = parseActionsFromText("add task read chapter 4 and start a 25 minute session", TODAY);
    expect(both.map((a) => a.type).sort()).toEqual(["create_task", "start_session"]);
  });

  it("completes a task it was told to complete", () => {
    const actions = parseActionsFromText("mark revise physics done", TODAY);
    expect(actions).toEqual([{ type: "complete_task", title: "revise physics" }]);
  });

  it("does not invent work from a question", () => {
    // The most important negative case: advice requests must stay advice.
    for (const question of [
      "how do I stop getting distracted",
      "why am I always tired in the afternoon",
      "what should I study first",
      "I keep procrastinating, help",
    ]) {
      expect(parseActionsFromText(question, TODAY), `“${question}” created work`).toEqual([]);
    }
  });

  it("ignores durations outside the session bounds rather than starting a 900-minute block", () => {
    const actions = parseActionsFromText("start a 900 minute session", TODAY);
    // Out of range → the default is used, so the timer can never be armed with
    // a value the rest of the product would reject.
    expect(actions).toEqual([{ type: "start_session", minutes: 25, label: null }]);
  });

  it("resolves a weekday to the next occurrence, not this week's past one", () => {
    // 2026-09-24 is a Thursday, so "on friday" is tomorrow and "on monday" is in
    // four days — never in the past.
    const friday = parseActionsFromText("add task finish the essay on friday", TODAY);
    expect(friday[0]).toMatchObject({ dueDate: "2026-09-25" });
    const monday = parseActionsFromText("add task finish the essay on monday", TODAY);
    expect(monday[0]).toMatchObject({ dueDate: "2026-09-28" });
  });
});
