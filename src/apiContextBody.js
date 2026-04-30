export function createJsonBodyReader(request) {
  let loaded = false;
  let cachedBody;
  let bodyError = null;

  return async function readJsonBody() {
    if (!loaded) {
      try {
        cachedBody = await request.clone().json();
      } catch (error) {
        bodyError = error;
      }
      loaded = true;
    }
    if (bodyError) throw bodyError;
    return cachedBody;
  };
}

export function formatD1Timestamp(date) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}
