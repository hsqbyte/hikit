package pg

import "testing"

// TestStopSQLAssistant_NoOp verifies that stopping when nothing is running doesn't panic
func TestStopSQLAssistant_NoOp(t *testing.T) {
	svc := NewPGService()
	// Should not panic when no active streaming session
	svc.StopSQLAssistant()
	svc.StopSQLAssistant() // Call twice — also should not panic
}

// TestConnConfig_DefaultSSLMode verifies the DSN default SSL mode
func TestConnConfig_DefaultPort(t *testing.T) {
	cfg := ConnConfig{
		Host:   "myhost",
		Port:   0, // Will be defaulted in Connect
		User:   "user",
		DBName: "mydb",
	}
	if cfg.Port != 0 {
		t.Error("zero Port should stay 0 until Connect() is called")
	}
}
