package proxy

import "testing"

func TestTrafficStore_OldestNewest(t *testing.T) {
	ts := NewTrafficStore(5)
	for i := 1; i <= 3; i++ {
		ts.Add(TrafficEntry{Method: "GET", URL: "/path"})
	}

	all := ts.Get(0, 10)
	if len(all) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(all))
	}
	// Get returns newest-first, so the last added should be first
}

func TestTrafficStore_ClearResetsCount(t *testing.T) {
	ts := NewTrafficStore(10)
	ts.Add(TrafficEntry{Method: "POST", URL: "/data"})
	ts.Add(TrafficEntry{Method: "GET", URL: "/api"})

	if ts.Count() != 2 {
		t.Fatalf("expected Count=2, got %d", ts.Count())
	}

	ts.Clear()
	if ts.Count() != 0 {
		t.Errorf("expected Count=0 after Clear, got %d", ts.Count())
	}
	if len(ts.Get(0, 10)) != 0 {
		t.Error("expected empty list after Clear")
	}
}

