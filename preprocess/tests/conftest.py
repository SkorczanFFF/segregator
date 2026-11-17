import os

# The handler makes its S3 client when it is imported, so it gets made-up keys and never the
# machine's own sign-in. Tests replace the client before any call.
os.environ.update(
    AWS_DEFAULT_REGION="eu-north-1",
    AWS_ACCESS_KEY_ID="test",
    AWS_SECRET_ACCESS_KEY="test",
    DOCUMENTS_BUCKET="documents-test",
)
