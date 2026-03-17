package restclient

import "testing"

func TestRestClientService_New(t *testing.T) {
	svc := NewRestClientService()
	if svc == nil {
		t.Fatal("NewRestClientService() returned nil")
	}
}
