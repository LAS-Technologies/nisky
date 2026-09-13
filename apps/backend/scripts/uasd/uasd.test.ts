import { describe, expect, test } from "bun:test";
import { DateTime } from "luxon";
import { parseActivityDetails } from "./activities";
import { buildCalendarUrl, parseCalendarPage } from "./calendar";
import { buildLoginBody, parseLoginResponse, parseSelectionResponse } from "./gateway";
import { buildHandoffBody, validateHandoffUrl } from "./handoff";
import { chooseTarget, mergeCalendarEvents, parseUasdDate } from "./normalize";
import { scrapeUasd, validateUasdInput } from "./scraper";
import { redactedUrl, validateUasdUrl } from "./transport";
import { UASD_GATEWAY_URL, UASD_LOGIN_URL } from "./types";
import type { UasdCalendarEvent, UasdCourse } from "./types";
import type { UasdHttpClient, UasdHttpRequest, UasdHttpResponse } from "./transport";

const fixture = (name: string) => Bun.file(new URL(`./fixtures/${name}`, import.meta.url)).text();

describe("UASD normalization", () => {
  test("parses Spanish and English-style dates in Santo Domingo time", () => {
    expect(parseUasdDate("martes, 8 de septiembre de 2026, 23:59")).toBe("2026-09-08T23:59:00.000-04:00");
    expect(parseUasdDate("Tuesday, 8 September 2026, 11:59 PM")).toBe("2026-09-08T23:59:00.000-04:00");
  });

  test("uses URL for student handoffs, including W/Z sections", async () => {
    const records = parseSelectionResponse(
      await fixture("selection.json"),
      {
        matricula: "STUDENT_FIXTURE",
        matricula2: "STUDENT_FIXTURE_2",
        token: "TOKEN_FIXTURE",
        assignments: [],
      },
      "202610",
    );
    expect(chooseTarget(records[0]!)).toBe("https://aulavirtual.uasd.edu.do/login/wsuasd.php");
    expect(chooseTarget(records[1]!)).toBe("https://humanidades.uasd.edu.do/login/wsuasd.php");
    expect(buildHandoffBody(records[0]!)).toContain("seccion=");
  });

  test("merges open and close calendar entries by activity key", () => {
    const base: UasdCalendarEvent = {
      key: "host:1:quiz:2",
      eventId: "1",
      host: "aulavirtual.uasd.edu.do",
      courseId: "1",
      kind: "quiz",
      activityId: "2",
      title: "Quiz",
      url: "https://aulavirtual.uasd.edu.do/mod/quiz/view.php?id=2",
      eventDate: "2026-09-07T23:59:00.000-04:00",
      eventName: "Se abre Quiz",
    };
    const merged = mergeCalendarEvents([
      base,
      { ...base, eventId: "2", eventDate: "2026-09-08T23:59:00.000-04:00", eventName: "Se cierra Quiz" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.eventDate).toContain("2026-09-08");
  });
});

describe("UASD HTML parsers", () => {
  test("reads day attributes and ignores unsupported Moodle modules", async () => {
    const course = fixtureCourse("9001", "Materia Fixture Uno");
    const events = parseCalendarPage(await fixture("calendar.html"), course);
    expect(events).toHaveLength(4);
    expect(events[0]?.eventDate).toContain("2026-09-07");
    expect(events.every((event) => ["assignment", "quiz", "forum"].includes(event.kind))).toBe(true);
  });

  test("preserves the Moodle installation prefix when building calendar URLs", () => {
    const course = fixtureCourse("9001", "Materia Fixture Uno");
    course.url = "https://aulavirtual.uasd.edu.do/revision/course/view.php?id=9001";
    expect(new URL(buildCalendarUrl(course, DateTime.fromISO("2026-09-01"))).pathname).toBe("/revision/calendar/view.php");
  });

  test("extracts assignment and quiz dates without forum posts", async () => {
    const event = fixtureEvent("quiz", "9101", "Quiz Fixture", "2026-09-08");
    const quiz = parseActivityDetails(await fixture("quiz.html"), event);
    expect(quiz.title).toBe("Quiz Fixture");
    expect(quiz.openDate).toContain("2026-09-07T00:00");
    expect(quiz.closeDate).toContain("2026-09-08T23:59");
    expect(quiz.dueDate).toBe(quiz.closeDate);

    const assignment = parseActivityDetails(await fixture("assignment.html"), {
      ...event,
      kind: "assignment",
      activityId: "9201",
      url: "https://ciencias.uasd.edu.do/mod/assign/view.php?id=9201",
    });
    expect(assignment.dueDate).toContain("2026-09-08T23:59");

    const forum = parseActivityDetails(await fixture("forum.html"), {
      ...event,
      kind: "forum",
      activityId: "9301",
      url: "https://ciencias.uasd.edu.do/mod/forum/view.php?id=9301",
    });
    expect(forum.dueDate).toBeNull();
    expect(forum.closeDate).toBeNull();

    const submitted = parseActivityDetails('<h2>Assignment</h2><div class="submissionstatussubmitted">Enviado para calificar</div>', {
      ...event,
      kind: "assignment",
    });
    expect(submitted.completed).toBe(true);

    const notSubmitted = parseActivityDetails('<h2>Assignment</h2><div class="submissionstatus">No se ha enviado nada</div>', {
      ...event,
      kind: "assignment",
    });
    expect(notSubmitted.completed).toBe(false);

    const closedQuiz = parseActivityDetails("<h2>Quiz</h2><p>Este cuestionario se cerró el Sunday, 6 de September de 2026, 23:59</p>", event);
    expect(closedQuiz.closeDate).toContain("2026-09-06T23:59");
    expect(closedQuiz.dueDate).toBe(closedQuiz.closeDate);
  });
});

describe("UASD gateway", () => {
  test("keeps the observed ASP.NET request shape without exposing values", async () => {
    expect(buildLoginBody("student", "secret value")).toBe("{'txtidbanner':'student','txtpassword':'secret%20value','captcha':'undefined'}");
    const login = parseLoginResponse(await fixture("gateway-login.json"));
    expect(login.MATRICULA).toBe("STUDENT_FIXTURE");
    expect(login.ASIGNATURAS).toHaveLength(1);
  });
});

describe("UASD transport guards", () => {
  test("allows only HTTPS UASD hosts and redacts query strings", () => {
    expect(validateUasdUrl("https://ciencias.uasd.edu.do/course/view.php?id=9001").hostname).toBe("ciencias.uasd.edu.do");
    expect(validateUasdUrl("https://facultad-nueva.uasd.edu.do/course/view.php?id=9002").hostname).toBe("facultad-nueva.uasd.edu.do");
    expect(redactedUrl("https://ciencias.uasd.edu.do/course/view.php?id=9001&tk=fixture")).toBe("https://ciencias.uasd.edu.do/course/view.php?id=9001");
    expect(redactedUrl("https://ciencias.uasd.edu.do/calendar/view.php?view=month&course=9001&time=1777953600&tk=fixture")).toBe("https://ciencias.uasd.edu.do/calendar/view.php?view=month&course=9001&time=1777953600");
    expect(() => validateUasdUrl("https://example.com/")).toThrow();
    expect(() => validateUasdUrl("https://eviluasd.edu.do/")).toThrow();
    expect(() => validateUasdUrl("https://uasd.edu.do.attacker.example/")).toThrow();
    expect(() => validateUasdUrl("https://ciencias.uasd.edu.do:8443/")).toThrow();
  });

  test("allows new UASD handoff subdomains without broadening the domain boundary", () => {
    expect(validateHandoffUrl("https://facultad-nueva.uasd.edu.do/login/wsuasd.php")).toBe("https://facultad-nueva.uasd.edu.do/login/wsuasd.php");
    expect(() => validateHandoffUrl("https://eviluasd.edu.do/login/wsuasd.php")).toThrow();
    expect(() => validateHandoffUrl("https://facultad-nueva.uasd.edu.do/otro-endpoint")).toThrow();
  });
});

describe("UASD scraper", () => {
  test("runs the complete flow against anonymized fixtures", async () => {
    const client = new FixtureClient({
      login: await fixture("gateway-login.json"),
      selection: await fixture("selection.json"),
      calendar: await fixture("calendar.html"),
      assignment: await fixture("assignment.html"),
      quiz: await fixture("quiz.html"),
      forum: await fixture("forum.html"),
    });

    const result = await scrapeUasd({
      username: "student",
      password: "fixture password",
      period: "202610",
      from: "2026-09-01",
      to: "2026-09-30",
    }, { client });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.courses).toHaveLength(2);
    expect(result.items).toHaveLength(6);
    expect(result.items.filter((item) => item.kind === "quiz")[0]?.dueDate).toContain("2026-09-08T23:59");
    expect(result.items.find((item) => item.kind === "assignment")?.course).toBe("Materia Fixture Uno");
    expect(result.stats).toMatchObject({ requests: 13, redirects: 0, courses: 2, calendarPages: 2, calendarEvents: 6, activityPages: 6, items: 6 });
    expect(client.calls.find((call) => call.url === UASD_LOGIN_URL)?.body).toContain("txtidbanner");
    expect(client.calls.filter((call) => call.url === UASD_LOGIN_URL)).toHaveLength(1);
  });

  test("rejects invalid date ranges before opening a session", () => {
    expect(() => validateUasdInput({ username: "student", password: "pw", period: "2026", from: "2026-09-02", to: "2026-09-01" })).toThrow();
  });

  test("accepts only the two UASD academic period codes", () => {
    expect(() => validateUasdInput({ username: "student", password: "pw", period: "202611", from: "2026-09-01", to: "2026-09-30" })).toThrow();
    expect(() => validateUasdInput({ username: "student", password: "pw", period: "202610", from: "2026-09-01", to: "2026-09-30" })).not.toThrow();
  });

  test("does not treat an unrelated HTML 200 as an empty calendar", async () => {
    const client = new FixtureClient({
      login: await fixture("gateway-login.json"),
      selection: await fixture("selection.json"),
      calendar: "<html><title>Course</title></html>",
      assignment: await fixture("assignment.html"),
      quiz: await fixture("quiz.html"),
      forum: await fixture("forum.html"),
    });
    const result = await scrapeUasd({ username: "student", password: "fixture password", period: "202610", from: "2026-09-01", to: "2026-09-30" }, { client });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UNEXPECTED_RESPONSE");
  });

  test("passes the local replay gates at 1, 20, 50, and 100 runs", async () => {
    const bodies = {
      login: await fixture("gateway-login.json"),
      selection: await fixture("selection.json"),
      calendar: await fixture("calendar.html"),
      assignment: await fixture("assignment.html"),
      quiz: await fixture("quiz.html"),
      forum: await fixture("forum.html"),
    };
    const input = {
      username: "student",
      password: "fixture password",
      period: "202610",
      from: "2026-09-01",
      to: "2026-09-30",
    };

    for (const runCount of [1, 20, 50, 100]) {
      const results = await Promise.all(Array.from({ length: runCount }, () => scrapeUasd(input, { client: new FixtureClient(bodies) })));
      expect(results.every((result) => result.ok && result.items.length === 6 && result.stats.requests === 13)).toBe(true);
    }
  });
});

function fixtureCourse(courseId: string, name: string): UasdCourse {
  return {
    host: "ciencias.uasd.edu.do",
    courseId,
    code: "FIX100",
    name,
    section: "W01",
    modality: "VIRTU",
    period: "202610",
    url: `https://ciencias.uasd.edu.do/course/view.php?id=${courseId}`,
  };
}

function fixtureEvent(kind: UasdCalendarEvent["kind"], activityId: string, title: string, date: string): UasdCalendarEvent {
  return {
    key: `ciencias.uasd.edu.do:9001:${kind}:${activityId}`,
    eventId: "fixture",
    host: "ciencias.uasd.edu.do",
    courseId: "9001",
    kind,
    activityId,
    title,
    url: `https://ciencias.uasd.edu.do/mod/${kind}/view.php?id=${activityId}`,
    eventDate: `${date}T23:59:00.000-04:00`,
    eventName: title,
  };
}

interface FixtureBodies {
  login: string;
  selection: string;
  calendar: string;
  assignment: string;
  quiz: string;
  forum: string;
}

interface FixtureCall {
  url: string;
  method: string;
  body?: string;
}

class FixtureClient implements UasdHttpClient {
  readonly stats = { requests: 0, redirects: 0 };
  readonly calls: FixtureCall[] = [];
  private closed = false;

  constructor(private readonly bodies: FixtureBodies) {}

  async request(input: string | URL, init: UasdHttpRequest = {}): Promise<UasdHttpResponse> {
    if (this.closed) throw new Error("fixture client closed");
    const url = new URL(input);
    this.stats.requests += 1;
    this.calls.push({ url: url.toString(), method: init.method ?? "GET", ...(init.body === undefined ? {} : { body: init.body }) });

    if (url.toString() === `${UASD_GATEWAY_URL}/`) return response(200, url.toString(), "<html><title>UASD Virtual</title></html>");
    if (url.toString() === UASD_LOGIN_URL) return response(200, url.toString(), this.bodies.login);
    if (url.pathname.endsWith("/Default.aspx/SeleccionAsignaturas")) return response(200, url.toString(), this.bodies.selection);
    if (url.pathname.endsWith("/login/wsuasd.php")) {
      const courseId = init.body?.includes("FIX100") ? "9001" : "9002";
      const host = courseId === "9001" ? "ciencias.uasd.edu.do" : "humanidades.uasd.edu.do";
      return response(200, `https://${host}/course/view.php?id=${courseId}`, "<html><title>Course</title></html>");
    }
    if (url.pathname === "/calendar/view.php") return response(200, url.toString(), this.bodies.calendar);
    if (url.pathname.includes("/mod/assign/view.php")) return response(200, url.toString(), this.bodies.assignment);
    if (url.pathname.includes("/mod/quiz/view.php")) return response(200, url.toString(), this.bodies.quiz);
    if (url.pathname.includes("/mod/forum/view.php")) return response(200, url.toString(), this.bodies.forum);
    throw new Error(`unexpected fixture URL ${url.pathname}`);
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

function response(status: number, url: string, body: string): UasdHttpResponse {
  return {
    status,
    url,
    body,
    redirected: false,
    headers: { get: () => null },
  };
}
