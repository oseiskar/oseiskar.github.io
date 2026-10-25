// Runs the decoder off the main thread
importScripts('decoder.js');

self.onmessage = (e) => {
  const { id, gray, width, height, bbox, timeLimitMs } = e.data;
  let out;
  try {
    out = BarcodeDecoder.decode({ data: gray, width, height }, bbox, { trace: true, timeLimitMs });
  } catch (err) {
    out = { result: null, trace: null, error: String(err && err.stack || err) };
  }
  self.postMessage(Object.assign({ id }, out));
};
