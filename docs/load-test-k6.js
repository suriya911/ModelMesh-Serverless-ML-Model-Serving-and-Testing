import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "2m",
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
  },
};

const baseUrl = (__ENV.BASE_URL || "").replace(/\/$/, "");

if (!baseUrl) {
  throw new Error("BASE_URL env var is required. Example: k6 run -e BASE_URL=https://your-backend-url docs/load-test-k6.js");
}

export default function () {
  const predictionPayload = JSON.stringify({
    input: "ModelMesh load test inference payload",
    routing_mode: "auto",
  });

  const healthRes = http.get(`${baseUrl}/health`);
  check(healthRes, {
    "health returns 200": (r) => r.status === 200,
  });

  const modelsRes = http.get(`${baseUrl}/v1/models`);
  check(modelsRes, {
    "models returns 200": (r) => r.status === 200,
  });

  const predictionRes = http.post(`${baseUrl}/v1/predictions`, predictionPayload, {
    headers: { "Content-Type": "application/json" },
  });
  check(predictionRes, {
    "prediction returns 200": (r) => r.status === 200,
    "prediction has id": (r) => {
      try {
        return Boolean(r.json("id"));
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
