use crate::miniflux::types::*;
use base64::{prelude::BASE64_STANDARD, Engine};
use reqwest::{header, Client};
use serde::de::DeserializeOwned;
use std::time::Duration;

/// Miniflux API Client
pub struct MinifluxClient {
    base_url: String,
    auth_token: Option<String>,
    username: Option<String>,
    password: Option<String>,
    http_client: Client,
}

impl MinifluxClient {
    /// Create a new Miniflux client
    pub fn new(base_url: String) -> Self {
        let http_client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            auth_token: None,
            username: None,
            password: None,
            http_client,
        }
    }

    /// Set API token authentication
    pub fn with_token(mut self, token: String) -> Self {
        self.auth_token = Some(token);
        self
    }

    /// Set username/password authentication
    pub fn with_credentials(mut self, username: String, password: String) -> Self {
        self.username = Some(username);
        self.password = Some(password);
        self
    }

    /// Build request with authentication
    fn build_request(&self, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}/v1/{}", self.base_url, path);
        let mut request = self.http_client.get(&url);

        // Add authentication
        if let Some(token) = &self.auth_token {
            request = request.header("X-Auth-Token", token);
        } else if let (Some(username), Some(password)) = (&self.username, &self.password) {
            request = request.header(
                header::AUTHORIZATION,
                header::HeaderValue::from_str(&format!(
                    "Basic {}",
                    BASE64_STANDARD.encode(&format!("{}:{}", username, password))
                ))
                .unwrap(),
            );
        }

        request
    }

    /// Build POST request with authentication
    fn build_post_request(&self, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}/v1/{}", self.base_url, path);
        let mut request = self.http_client.post(&url);

        // Add authentication
        if let Some(token) = &self.auth_token {
            request = request.header("X-Auth-Token", token);
        } else if let (Some(username), Some(password)) = (&self.username, &self.password) {
            request = request.header(
                header::AUTHORIZATION,
                header::HeaderValue::from_str(&format!(
                    "Basic {}",
                    BASE64_STANDARD.encode(&format!("{}:{}", username, password))
                ))
                .unwrap(),
            );
        }

        request
    }

    /// Build PUT request with authentication
    fn build_put_request(&self, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}/v1/{}", self.base_url, path);
        let mut request = self.http_client.put(&url);

        // Add authentication
        if let Some(token) = &self.auth_token {
            request = request.header("X-Auth-Token", token);
        } else if let (Some(username), Some(password)) = (&self.username, &self.password) {
            request = request.header(
                header::AUTHORIZATION,
                header::HeaderValue::from_str(&format!(
                    "Basic {}",
                    BASE64_STANDARD.encode(&format!("{}:{}", username, password))
                ))
                .unwrap(),
            );
        }

        request
    }

    /// Build DELETE request with authentication
    fn build_delete_request(&self, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}/v1/{}", self.base_url, path);
        let mut request = self.http_client.delete(&url);

        // Add authentication
        if let Some(token) = &self.auth_token {
            request = request.header("X-Auth-Token", token);
        } else if let (Some(username), Some(password)) = (&self.username, &self.password) {
            request = request.header(
                header::AUTHORIZATION,
                header::HeaderValue::from_str(&format!(
                    "Basic {}",
                    BASE64_STANDARD.encode(&format!("{}:{}", username, password))
                ))
                .unwrap(),
            );
        }

        request
    }

    /// Execute GET request and parse response
    async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, String> {
        let response = self
            .build_request(path)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let url = response.url().clone();
            return Err(format!("API error: {} - {}", status, url));
        }

        // Log response for debugging
        let response_text = response.text().await.map_err(|e| {
            log::error!("Failed to read response body: {}", e);
            format!("Failed to read response body: {}", e)
        })?;

        log::debug!("API Response from {}: {}", path, response_text);

        serde_json::from_str(&response_text).map_err(|e| {
            log::error!("Failed to parse JSON from {}: {}", path, e);
            log::error!("Response body was: {}", response_text);
            format!("Parse error: {}", e)
        })
    }

    /// Execute POST request and parse response
    async fn post<T: DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, String> {
        let response = self
            .build_post_request(path)
            .json(body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("API error: {}", response.status()));
        }

        response
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))
    }

    /// Execute PUT request and parse response
    async fn put<T: DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: Option<&B>,
    ) -> Result<T, String> {
        let mut request = self.build_put_request(path);
        if let Some(b) = body {
            request = request.json(b);
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("API error: {}", response.status()));
        }

        response
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))
    }

    /// Execute DELETE request
    async fn delete(&self, path: &str) -> Result<(), String> {
        let response = self
            .build_delete_request(path)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("API error: {}", response.status()));
        }

        Ok(())
    }

    // ==================== Authentication ====================

    /// Test authentication
    pub async fn authenticate(&self) -> Result<bool, String> {
        match self.get::<User>("me").await {
            Ok(_) => Ok(true),
            Err(e) => {
                if e.contains("401") || e.contains("403") {
                    Ok(false)
                } else {
                    Err(e)
                }
            }
        }
    }

    // ==================== Categories ====================

    /// Get all categories
    pub async fn get_categories(&self) -> Result<Vec<Category>, String> {
        self.get("categories").await
    }

    /// Create a new category
    pub async fn create_category(&self, title: String) -> Result<Category, String> {
        #[derive(serde::Serialize)]
        struct CreateCategory {
            title: String,
        }

        self.post("categories", &CreateCategory { title }).await
    }

    /// Update a category
    pub async fn update_category(&self, id: i64, title: String) -> Result<Category, String> {
        #[derive(serde::Serialize)]
        struct UpdateCategory {
            title: String,
        }

        self.put(
            &format!("categories/{}", id),
            Some(&UpdateCategory { title }),
        )
        .await
    }

    /// Delete a category
    pub async fn delete_category(&self, id: i64) -> Result<(), String> {
        self.delete(&format!("categories/{}", id)).await
    }

    // ==================== Feeds ====================

    /// Get all feeds
    pub async fn get_feeds(&self) -> Result<Vec<Feed>, String> {
        self.get("feeds").await
    }

    /// Get feeds by category
    pub async fn get_category_feeds(&self, category_id: i64) -> Result<Vec<Feed>, String> {
        self.get(&format!("categories/{}/feeds", category_id)).await
    }

    /// Get a single feed
    pub async fn get_feed(&self, id: i64) -> Result<Feed, String> {
        self.get(&format!("feeds/{}", id)).await
    }

    /// Create a new feed
    pub async fn create_feed(
        &self,
        feed_url: String,
        category_id: Option<i64>,
    ) -> Result<i64, String> {
        #[derive(serde::Serialize)]
        struct CreateFeed {
            feed_url: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            category_id: Option<i64>,
        }

        #[derive(serde::Deserialize)]
        struct CreateFeedResponse {
            feed_id: i64,
        }

        let response: CreateFeedResponse = self
            .post(
                "feeds",
                &CreateFeed {
                    feed_url,
                    category_id,
                },
            )
            .await?;

        Ok(response.feed_id)
    }

    /// Update a feed
    pub async fn update_feed(&self, id: i64, updates: FeedUpdate) -> Result<Feed, String> {
        self.put(&format!("feeds/{}", id), Some(&updates)).await
    }

    /// Delete a feed
    pub async fn delete_feed(&self, id: i64) -> Result<(), String> {
        self.delete(&format!("feeds/{}", id)).await
    }

    /// Refresh a feed
    pub async fn refresh_feed(&self, id: i64) -> Result<(), String> {
        self.put(&format!("feeds/{}/refresh", id), None::<&()>)
            .await
    }

    /// Refresh all feeds
    pub async fn refresh_all_feeds(&self) -> Result<(), String> {
        self.put("feeds/refresh", None::<&()>).await
    }

    /// Get feed icon
    pub async fn get_feed_icon(&self, feed_id: i64) -> Result<Icon, String> {
        self.get(&format!("feeds/{}/icon", feed_id)).await
    }

    // ==================== Entries ====================

    /// Get entries with filters
    pub async fn get_entries(&self, filters: &EntryFilters) -> Result<EntryResponse, String> {
        let mut query_params = Vec::new();

        if let Some(status) = &filters.status {
            query_params.push(format!("status={}", status));
        }
        if let Some(offset) = filters.offset {
            query_params.push(format!("offset={}", offset));
        }
        if let Some(limit) = filters.limit {
            query_params.push(format!("limit={}", limit));
        }
        if let Some(order) = &filters.order {
            query_params.push(format!("order={}", order));
        }
        if let Some(direction) = &filters.direction {
            query_params.push(format!("direction={}", direction));
        }
        if let Some(before) = filters.before {
            query_params.push(format!("before={}", before));
        }
        if let Some(after) = filters.after {
            query_params.push(format!("after={}", after));
        }
        if let Some(published_before) = filters.published_before {
            query_params.push(format!("published_before={}", published_before));
        }
        if let Some(published_after) = filters.published_after {
            query_params.push(format!("published_after={}", published_after));
        }
        if let Some(changed_before) = filters.changed_before {
            query_params.push(format!("changed_before={}", changed_before));
        }
        if let Some(changed_after) = filters.changed_after {
            query_params.push(format!("changed_after={}", changed_after));
        }
        if let Some(before_entry_id) = filters.before_entry_id {
            query_params.push(format!("before_entry_id={}", before_entry_id));
        }
        if let Some(after_entry_id) = filters.after_entry_id {
            query_params.push(format!("after_entry_id={}", after_entry_id));
        }
        if let Some(starred) = filters.starred {
            query_params.push(format!("starred={}", starred));
        }
        if let Some(search) = &filters.search {
            query_params.push(format!("search={}", urlencoding::encode(search)));
        }
        if let Some(category_id) = filters.category_id {
            query_params.push(format!("category_id={}", category_id));
        }
        if let Some(feed_id) = filters.feed_id {
            query_params.push(format!("feed_id={}", feed_id));
        }
        if let Some(globally_visible) = filters.globally_visible {
            query_params.push(format!("globally_visible={}", globally_visible));
        }

        let path = if query_params.is_empty() {
            "entries".to_string()
        } else {
            format!("entries?{}", query_params.join("&"))
        };

        self.get(&path).await
    }

    /// Get a single entry
    pub async fn get_entry(&self, id: i64) -> Result<Entry, String> {
        self.get(&format!("entries/{}", id)).await
    }

    /// Update an entry
    pub async fn update_entry(&self, id: i64, updates: EntryUpdate) -> Result<Entry, String> {
        self.put(&format!("entries/{}", id), Some(&updates)).await
    }

    /// Update multiple entries status
    pub async fn update_entries(&self, ids: Vec<i64>, status: String) -> Result<(), String> {
        #[derive(serde::Serialize)]
        struct UpdateEntries {
            status: String,
            entry_ids: Vec<i64>,
        }

        self.put(
            "entries",
            Some(&UpdateEntries {
                status,
                entry_ids: ids,
            }),
        )
        .await
    }

    /// Toggle entry bookmark
    pub async fn toggle_bookmark(&self, id: i64) -> Result<(), String> {
        self.post(&format!("entries/{}/bookmark", id), &()).await
    }

    /// Fetch original article content
    pub async fn fetch_content(&self, id: i64, update_content: bool) -> Result<String, String> {
        let path = format!(
            "entries/{}/fetch-content?update_content={}",
            id, update_content
        );
        self.get(&path).await
    }

    // ==================== Enclosures ====================

    /// Get enclosure
    pub async fn get_enclosure(&self, entry_id: i64) -> Result<Enclosure, String> {
        self.get(&format!("entries/{}/enclosure", entry_id)).await
    }

    /// Update enclosure status
    pub async fn update_enclosure(&self, id: i64, status: String) -> Result<(), String> {
        #[derive(serde::Serialize)]
        struct UpdateEnclosure {
            status: String,
        }

        self.put(
            &format!("enclosures/{}", id),
            Some(&UpdateEnclosure { status }),
        )
        .await
    }

    // ==================== Users ====================

    /// Get current user
    pub async fn get_current_user(&self) -> Result<User, String> {
        self.get("me").await
    }

    /// Get all users
    pub async fn get_users(&self) -> Result<Vec<User>, String> {
        self.get("users").await
    }

    /// Create a new user
    pub async fn create_user(&self, user: UserCreate) -> Result<User, String> {
        self.post("users", &user).await
    }

    /// Update a user
    pub async fn update_user(&self, id: i64, updates: UserUpdate) -> Result<User, String> {
        self.put(&format!("users/{}", id), Some(&updates)).await
    }

    /// Delete a user
    pub async fn delete_user(&self, id: i64) -> Result<(), String> {
        self.delete(&format!("users/{}", id)).await
    }

    // ==================== Counters ====================

    /// Get unread and read counters
    pub async fn get_counters(&self) -> Result<Counters, String> {
        self.get("counters").await
    }

    // ==================== OPML ====================

    /// Export OPML
    pub async fn export_opml(&self) -> Result<String, String> {
        self.get("export").await
    }

    /// Import OPML
    pub async fn import_opml(&self, opml_content: String) -> Result<(), String> {
        #[derive(serde::Serialize)]
        struct ImportOpml {
            opml: String,
        }

        self.post("import", &ImportOpml { opml: opml_content })
            .await
    }

    // ==================== Discover ====================

    /// Discover subscriptions from a URL
    pub async fn discover(&self, url: String) -> Result<Vec<Subscription>, String> {
        #[derive(serde::Serialize)]
        struct DiscoverUrl {
            url: String,
        }

        self.post("discover", &DiscoverUrl { url }).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = MinifluxClient::new("https://miniflux.example.org".to_string());
        assert_eq!(client.base_url, "https://miniflux.example.org");
    }

    #[test]
    fn test_client_with_token() {
        let client = MinifluxClient::new("https://miniflux.example.org".to_string())
            .with_token("test-token".to_string());
        assert_eq!(client.auth_token, Some("test-token".to_string()));
    }

    #[test]
    fn test_client_with_credentials() {
        let client = MinifluxClient::new("https://miniflux.example.org".to_string())
            .with_credentials("user".to_string(), "pass".to_string());
        assert_eq!(client.username, Some("user".to_string()));
        assert_eq!(client.password, Some("pass".to_string()));
    }
}
