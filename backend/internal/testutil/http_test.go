package testutil

import "testing"

func TestValidateTestURL(t *testing.T) {
	cases := []struct {
		url     string
		wantErr bool
	}{
		{"http://127.0.0.1:8080/api/x", false},
		{"https://localhost/api/x", false},
		{"http://[::1]:9000/", false},
		{"http://example.com/api", true},
		{"http://169.254.169.254/latest/meta-data", true},
		{"http://localhost.evil.com/", true},
		{"http://127.0.0.1@evil.com/", true},
		{"ftp://127.0.0.1/file", true},
		{"://bad", true},
	}
	for _, c := range cases {
		err := validateTestURL(c.url)
		if (err != nil) != c.wantErr {
			t.Errorf("validateTestURL(%q) err = %v, wantErr %v", c.url, err, c.wantErr)
		}
	}
}
