import unittest
from datetime import date, timedelta

from server import assignment_events


class CanvasEventParsingTests(unittest.TestCase):
    def test_imports_assignment_events_and_ignores_class_events(self):
        due = (date.today() + timedelta(days=2)).strftime("%Y%m%d")
        old = (date.today() - timedelta(days=10)).strftime("%Y%m%d")
        calendar = f"""BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:assignment-1
SUMMARY:Assignment: Intro essay
DTSTART;VALUE=DATE:{due}
END:VEVENT
BEGIN:VEVENT
UID:class-1
SUMMARY:Lecture: Cell Biology
DTSTART;VALUE=DATE:{due}
END:VEVENT
BEGIN:VEVENT
UID:assignment-old
SUMMARY:Homework: Old problem set
DTSTART;VALUE=DATE:{old}
END:VEVENT
END:VCALENDAR
""".encode("utf-8")

        events = assignment_events(calendar)

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["uid"], "assignment-1")
        self.assertEqual(events[0]["title"], "Intro essay")
        self.assertEqual(events[0]["due"], due[:4] + "-" + due[4:6] + "-" + due[6:])


if __name__ == "__main__":
    unittest.main()