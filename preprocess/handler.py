"""Straightens each new photo under raw/ into processed/, whose arrival starts the worker.

The key layout is the one in api/src/document-files.ts. This function never writes to the table.
"""

import json
import logging
import os
import re
from urllib.parse import unquote_plus

import boto3
import cv2
import numpy as np

from document import straighten

logger = logging.getLogger()

s3 = boto3.client("s3")
BUCKET = os.environ.get("DOCUMENTS_BUCKET", "")
# The queue's last try copies the original as it is, so a photo that keeps timing out still reaches the worker.
MAX_RECEIVES = int(os.environ["MAX_RECEIVES"])

RAW_KEY = re.compile(r"^raw/([^/]+)/([0-9A-HJKMNP-TV-Z]{26})$")
# The first bytes of the photo types, as in api/src/worker.ts; anything else, such as a PDF, is copied as it is.
SIGNATURES = {"image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG\r\n\x1a\n"}
# As in web/src/features/upload/prepare.ts, which sends every photo as a JPEG.
JPEG_QUALITY = 90


def handler(event, context):
    """A failed message goes back to the queue alone, so the rest of its batch never runs again."""
    failures = []
    for message in event["Records"]:
        try:
            process_message(message)
        except Exception:
            logger.exception("Preprocessing failed for message %s", message["messageId"])
            failures.append({"itemIdentifier": message["messageId"]})
    return {"batchItemFailures": failures}


def process_message(message):
    last_try = int(message["attributes"]["ApproximateReceiveCount"]) >= MAX_RECEIVES
    # S3's test event, sent when the notification is set up, has no records.
    for record in json.loads(message["body"]).get("Records", []):
        # S3 encodes the key as in a URL, with spaces as plus signs.
        source = unquote_plus(record["s3"]["object"]["key"])
        match = RAW_KEY.match(source)
        if not match:
            logger.warning("Skipped a key that is not a document file")
        elif last_try:
            copy_original(source, f"processed/{match[1]}/{match[2]}")
        else:
            process_file(source, f"processed/{match[1]}/{match[2]}")


def copy_original(source, target):
    s3.copy_object(Bucket=BUCKET, Key=target, CopySource={"Bucket": BUCKET, "Key": source})


def process_file(source, target):
    """Writes the straightened photo, or a copy of the original when there is nothing to straighten.

    The copy's metadata says what was done, and the worker passes it on to the document. A copy of the
    original has none.

    Errors from S3 go up, so the message is tried again. Anything that goes wrong with the image itself
    ends in a copy of the original, so the document goes on to the worker either way.
    """
    original = s3.get_object(Bucket=BUCKET, Key=source)
    image = decode(original["Body"].read(), original["ContentType"])
    result = jpeg = None
    if image is not None:
        try:
            result = straighten(image)
            if result is not None:
                encoded, jpeg = cv2.imencode(".jpg", result.image, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                if not encoded:
                    raise ValueError("The straightened photo could not be encoded")
        except Exception:
            logger.exception("Straightening failed, the original goes on")
            result = None
    if result is None:
        copy_original(source, target)
        return
    s3.put_object(
        Bucket=BUCKET,
        Key=target,
        Body=jpeg.tobytes(),
        ContentType="image/jpeg",
        Metadata={"change": result.change},
    )


def decode(data, content_type):
    """The photo as pixels, or None for a PDF, a file that isn't what it claims, or one over the pixel limit.

    The file comes from a browser, so its first bytes must match its type before OpenCV reads it.
    OPENCV_IO_MAX_IMAGE_PIXELS, set by the stack, stops a small file that unpacks into a huge image.
    """
    signature = SIGNATURES.get(content_type)
    if signature is None or not data.startswith(signature):
        return None
    try:
        return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    except cv2.error:
        logger.warning("The photo could not be decoded")
        return None
