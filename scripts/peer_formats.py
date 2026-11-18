"""Prints the PEER_FORMATS block for src/Components/Common/peerFormatsModel.js.

Read-only. Sums `users/{uid}/studyPerformance/{chatId}.formats` over every
student, leaving out the owner account, and prints correct / total / students
per question type. Paste the output over the block in peerFormatsModel.js and
update the numbers quoted in its tests.

Run it with the backend's interpreter, which has firebase_admin:

    NQBackEnd2/venv/Scripts/python.exe scripts/peer_formats.py path/to/service-account-key.json
"""
import sys
from collections import defaultdict
from datetime import date

import firebase_admin
from firebase_admin import credentials, firestore

OWNER_UID = "VymBNcl0KiOrv1tbPPQgjHal0SG3"
ORDER = ["mcq", "sata", "casestudy", "matrix"]


def main(key_path):
    firebase_admin.initialize_app(credentials.Certificate(key_path))
    db = firestore.client()
    totals = defaultdict(lambda: [0, 0])
    students = defaultdict(set)
    for snap in db.collection_group("studyPerformance").stream():
        uid = snap.reference.parent.parent.id
        if uid == OWNER_UID:
            continue
        formats = (snap.to_dict() or {}).get("formats") or {}
        if not isinstance(formats, dict):
            continue
        for key, bucket in formats.items():
            if not isinstance(bucket, dict):
                continue
            total = int(bucket.get("total") or 0)
            if total <= 0:
                continue
            totals[key][0] += min(total, int(bucket.get("correct") or 0))
            totals[key][1] += total
            students[key].add(uid)

    print("export const PEER_FORMATS = {")
    print(f"  measuredOn: '{date.today().isoformat()}',")
    print("  formats: {")
    for key in ORDER + sorted(k for k in totals if k not in ORDER):
        if key not in totals:
            continue
        correct, total = totals[key]
        print(f"    {key}: {{ correct: {correct}, total: {total}, students: {len(students[key])} }},"
              f"  // {round(100 * correct / total)}%")
    print("  },")
    print("};")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
