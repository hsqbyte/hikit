package chat

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

// ModelInfo represents a model returned by the OpenAI-compatible /v1/models endpoint
type ModelInfo struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	OwnedBy string `json:"owned_by"`
}

// ListModels calls the /v1/models endpoint and returns available model IDs
func ListModels(baseURL, apiKey string) ([]ModelInfo, error) {
	if baseURL == "" {
		return nil, fmt.Errorf("Base URL 未配置")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("API Key 未配置")
	}

	url := strings.TrimRight(baseURL, "/") + "/models"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		errMsg := string(body)
		if len(errMsg) > 300 {
			errMsg = errMsg[:300]
		}
		return nil, fmt.Errorf("API 错误 (%d): %s", resp.StatusCode, errMsg)
	}

	var result struct {
		Data []ModelInfo `json:"data"`
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	// Sort by model ID
	sort.Slice(result.Data, func(i, j int) bool {
		return result.Data[i].ID < result.Data[j].ID
	})

	return result.Data, nil
}
