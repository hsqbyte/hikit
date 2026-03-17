package proxy

import "testing"

func TestBreakpointManager_New(t *testing.T) {
	bm := NewBreakpointManager()
	if bm == nil {
		t.Fatal("NewBreakpointManager() returned nil")
	}
	if bm.PendingCount() != 0 {
		t.Errorf("expected 0 pending, got %d", bm.PendingCount())
	}
}

func TestBreakpointManager_ListPending_Empty(t *testing.T) {
	bm := NewBreakpointManager()
	ids := bm.ListPending()
	if len(ids) != 0 {
		t.Errorf("expected empty pending list, got %v", ids)
	}
}

func TestBreakpointManager_ReleaseRequest_NotFound(t *testing.T) {
	bm := NewBreakpointManager()
	err := bm.ReleaseRequest("nonexistent", BreakpointResult{Action: BreakpointRelease})
	if err == nil {
		t.Error("expected error releasing nonexistent breakpoint")
	}
}

func TestBreakpointAction_Constants(t *testing.T) {
	if BreakpointRelease != "release" {
		t.Errorf("expected BreakpointRelease='release', got %q", BreakpointRelease)
	}
	if BreakpointAbort != "abort" {
		t.Errorf("expected BreakpointAbort='abort', got %q", BreakpointAbort)
	}
}
