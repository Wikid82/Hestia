package testutil

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

// Do performs an HTTP request against the app using client, JSON-encoding
// body (if non-nil) and JSON-decoding the response into out (if non-nil).
// Fails the test on transport-level errors only — a non-2xx status is the
// caller's to assert on via the returned *http.Response.StatusCode.
func Do(t *testing.T, client *http.Client, method, url string, body, out any) *http.Response {
	t.Helper()

	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshaling request body: %v", err)
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, url, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("reading response body: %v", err)
	}

	if out != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, out); err != nil {
			t.Fatalf("decoding response body (%s): %v\nbody: %s", url, err, respBody)
		}
	}

	// Callers only get the status code and headers back via resp — the
	// body's already been consumed above, so give them a fresh (empty)
	// reader rather than a closed one, in case they inspect resp.Body.
	resp.Body = io.NopCloser(bytes.NewReader(respBody))
	return resp
}
