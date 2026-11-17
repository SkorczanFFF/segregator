// Read by the API and by the stack, which sets up the table and filters its stream on them.

// DynamoDB removes an item some time after the Unix time in this attribute.
export const TTL_ATTRIBUTE = 'expiresAt'

// A document's sort key starts with this.
export const DOC_PREFIX = 'DOC#'
