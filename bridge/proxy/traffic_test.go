package proxy

import "testing"

func TestTrafficStore_AddAndCount(t *testing.T) {
	ts := NewTrafficStore(5)
	if ts.Count() != 0 {
		t.Fatalf("expected 0 entries, got %d", ts.Count())
	}

	for i := 0; i < 3; i++ {
		ts.Add(TrafficEntry{ID: string(rune('a' + i))})
	}
	if ts.Count() != 3 {
		t.Fatalf("expected 3 entries, got %d", ts.Count())
	}
}

func TestTrafficStore_RingBuffer_Eviction(t *testing.T) {
	ts := NewTrafficStore(3)
	for i := 1; i <= 5; i++ {
		ts.Add(TrafficEntry{ID: string(rune('0' + i))})
	}
	// After adding 5 entries to a size-3 buffer, only latest 3 remain
	if ts.Count() != 3 {
		t.Fatalf("expected 3 entries (ring buffer eviction), got %d", ts.Count())
	}
}

func TestTrafficStore_Get_NewestFirst(t *testing.T) {
	ts := NewTrafficStore(10)
	ids := []string{"first", "second", "third"}
	for _, id := range ids {
		ts.Add(TrafficEntry{ID: id})
	}

	result := ts.Get(0, 10)
	if len(result) != 3 {
		t.Fatalf("expected 3 results, got %d", len(result))
	}
	// Newest first
	if result[0].ID != "third" {
		t.Errorf("expected newest entry first, got %q", result[0].ID)
	}
	if result[2].ID != "first" {
		t.Errorf("expected oldest entry last, got %q", result[2].ID)
	}
}

func TestTrafficStore_Get_EmptyStore(t *testing.T) {
	ts := NewTrafficStore(10)
	result := ts.Get(0, 10)
	if len(result) != 0 {
		t.Errorf("expected 0 results from empty store, got %d", len(result))
	}
}

func TestTrafficStore_Get_OffsetBeyondSize(t *testing.T) {
	ts := NewTrafficStore(10)
	ts.Add(TrafficEntry{ID: "only"})
	result := ts.Get(100, 10)
	if len(result) != 0 {
		t.Errorf("expected 0 results for offset beyond size, got %d", len(result))
	}
}

func TestTrafficStore_Clear(t *testing.T) {
	ts := NewTrafficStore(10)
	ts.Add(TrafficEntry{ID: "1"})
	ts.Add(TrafficEntry{ID: "2"})
	ts.Clear()
	if ts.Count() != 0 {
		t.Errorf("expected 0 after Clear(), got %d", ts.Count())
	}
}
