export const Errors = {
  ENTITY_NOT_FOUND: "entity not found",
  INVALID_PAYLOAD: "invalid payload",
};

const errorValues = Object.values(Errors);

export function sanitizeErrorMessage(message) {
  if (typeof message === "string" && errorValues.includes(message)) {
    return message;
  } else {
    return "an unknown error has occurred";
  }
}

export function mapErrorDetails(details) {
  return details.map((item) => ({
    message: item.message,
    path: item.path,
    type: item.type,
  }));
}
