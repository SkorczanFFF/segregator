import io
import json

import cv2
import numpy as np
import pytest

import handler
from tests.pages import on_table, page

KEY = "raw/0f1e2d3c-test/01KTEST0000000000000000002"
TARGET = "processed/0f1e2d3c-test/01KTEST0000000000000000002"


class FakeS3:
    """Stands in for S3 with these files, and keeps what the handler wrote."""

    def __init__(self, files):
        self.files = files
        self.written = {}

    def get_object(self, Bucket, Key):
        file = self.files[Key]
        if isinstance(file, Exception):
            raise file
        return {"Body": io.BytesIO(file["bytes"]), "ContentType": file["type"]}

    def put_object(self, Bucket, Key, Body, ContentType, Metadata):
        self.written[Key] = {"bytes": Body, "type": ContentType, "metadata": Metadata}

    def copy_object(self, Bucket, Key, CopySource):
        self.written[Key] = self.files[CopySource["Key"]]


@pytest.fixture
def s3(monkeypatch):
    def install(files):
        fake = FakeS3(files)
        monkeypatch.setattr(handler, "s3", fake)
        return fake

    return install


def message(key, message_id="message-1"):
    """An SQS message carrying an S3 notification, as Lambda hands it over."""
    body = {"Records": [{"eventSource": "aws:s3", "s3": {"object": {"key": key}}}]}
    return {"messageId": message_id, "body": json.dumps(body)}


def jpeg(image):
    return cv2.imencode(".jpg", image)[1].tobytes()


def test_writes_the_straightened_photo_to_processed(s3):
    photo = on_table(page(), [(330, 160), (1250, 210), (1290, 1450), (300, 1430)])
    fake = s3({KEY: {"bytes": jpeg(photo), "type": "image/jpeg"}})

    assert handler.handler({"Records": [message(KEY)]}, None) == {"batchItemFailures": []}
    written = fake.written[TARGET]
    assert written["type"] == "image/jpeg"
    assert written["metadata"] == {"change": "cut"}
    result = cv2.imdecode(np.frombuffer(written["bytes"], np.uint8), cv2.IMREAD_COLOR)
    assert result.shape[0] < photo.shape[0]


@pytest.mark.parametrize(
    "file",
    [
        {"bytes": b"%PDF-1.7 a document", "type": "application/pdf"},
        # A PDF that claims to be a photo is never decoded.
        {"bytes": b"%PDF-1.7 a document", "type": "image/jpeg"},
        # A straight page has nothing to fix.
        {"bytes": jpeg(page()), "type": "image/jpeg"},
    ],
)
def test_copies_the_original_when_there_is_nothing_to_straighten(s3, file):
    fake = s3({KEY: file})

    assert handler.handler({"Records": [message(KEY)]}, None) == {"batchItemFailures": []}
    assert fake.written[TARGET] == file


def test_sends_the_message_back_when_s3_fails(s3):
    s3({KEY: ConnectionError("S3 is unreachable")})
    assert handler.handler({"Records": [message(KEY)]}, None) == {
        "batchItemFailures": [{"itemIdentifier": "message-1"}]
    }


def test_skips_the_test_event_and_other_keys(s3):
    fake = s3({})
    test_event = {"messageId": "test", "body": json.dumps({"Service": "Amazon S3", "Event": "s3:TestEvent"})}

    result = handler.handler({"Records": [test_event, message("processed/x/01KTEST0000000000000000002")]}, None)
    assert result == {"batchItemFailures": []}
    assert fake.written == {}
