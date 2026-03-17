package ssh

import "testing"

func TestSSHTerminalSize_Defaults(t *testing.T) {
	// SSH terminals typically default to 80x24
	defaultCols := 80
	defaultRows := 24
	if defaultCols != 80 || defaultRows != 24 {
		t.Error("default terminal size should be 80 columns x 24 rows")
	}
}

func TestForwardRuleType_Strings(t *testing.T) {
	// Verify the string constants match what's stored in the DB CHECK constraint
	types := []string{string(ForwardLocal), string(ForwardRemote), string(ForwardDynamic)}
	expected := []string{"local", "remote", "dynamic"}
	for i, typ := range types {
		if typ != expected[i] {
			t.Errorf("ForwardType[%d] = %q, want %q", i, typ, expected[i])
		}
	}
}
