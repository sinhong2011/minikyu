//! Integration tests for S3 cloud sync operations against LocalStack.
//!
//! These tests require a running LocalStack instance on localhost:4566.
//! Run with: cargo test --lib cloud_sync::s3::tests -- --ignored

#[cfg(test)]
mod tests {
    use s3::bucket::Bucket;
    use s3::creds::Credentials;
    use s3::Region;

    const ENDPOINT: &str = "http://localhost:4566";
    const BUCKET: &str = "minikyu-test";
    const REGION: &str = "us-east-1";
    const ACCESS_KEY: &str = "test";
    const SECRET_KEY: &str = "test";

    fn test_bucket() -> Box<Bucket> {
        let region = Region::Custom {
            region: REGION.to_string(),
            endpoint: ENDPOINT.to_string(),
        };
        let credentials =
            Credentials::new(Some(ACCESS_KEY), Some(SECRET_KEY), None, None, None).unwrap();
        Bucket::new(BUCKET, region, credentials)
            .unwrap()
            .with_path_style()
    }

    #[tokio::test]
    #[ignore]
    async fn test_push_and_pull_roundtrip() {
        let bucket = test_bucket();
        let key = "test/roundtrip.json";
        let payload = r#"{"preferences":{"theme":"dark"},"server_urls":[],"synced_at":"2026-03-09T00:00:00Z"}"#;

        // Push
        let put_resp = bucket
            .put_object_with_content_type(key, payload.as_bytes(), "application/json")
            .await
            .expect("Push should succeed");
        assert!(
            put_resp.status_code() < 300,
            "Push status {} should be success",
            put_resp.status_code()
        );

        // Pull
        let get_resp = bucket
            .get_object(key)
            .await
            .expect("Pull should succeed");
        assert!(
            get_resp.status_code() < 300,
            "Pull status {} should be success",
            get_resp.status_code()
        );

        let body = String::from_utf8(get_resp.to_vec()).expect("Should be valid UTF-8");
        assert_eq!(body, payload);

        // Cleanup
        let _ = bucket.delete_object(key).await;
    }

    #[tokio::test]
    #[ignore]
    async fn test_pull_nonexistent_returns_404() {
        let bucket = test_bucket();
        let key = "test/does-not-exist.json";

        let resp = bucket.get_object(key).await;
        match resp {
            Ok(r) => assert_eq!(r.status_code(), 404, "Should return 404 for missing object"),
            Err(_) => {} // Some S3 clients return an error for 404, which is also acceptable
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_connection_list_bucket() {
        let bucket = test_bucket();

        let result = bucket
            .list("minikyu/".to_string(), Some("/".to_string()))
            .await;
        assert!(result.is_ok(), "Listing bucket should succeed");
    }

    #[tokio::test]
    #[ignore]
    async fn test_overwrite_existing_object() {
        let bucket = test_bucket();
        let key = "test/overwrite.json";

        // Write v1
        let v1 = r#"{"version":1}"#;
        bucket
            .put_object_with_content_type(key, v1.as_bytes(), "application/json")
            .await
            .expect("First push should succeed");

        // Overwrite with v2
        let v2 = r#"{"version":2}"#;
        bucket
            .put_object_with_content_type(key, v2.as_bytes(), "application/json")
            .await
            .expect("Overwrite should succeed");

        // Pull and verify v2
        let resp = bucket.get_object(key).await.expect("Pull should succeed");
        let body = String::from_utf8(resp.to_vec()).unwrap();
        assert_eq!(body, v2, "Should get the overwritten content");

        // Cleanup
        let _ = bucket.delete_object(key).await;
    }

    #[tokio::test]
    #[ignore]
    async fn test_large_payload() {
        let bucket = test_bucket();
        let key = "test/large-payload.json";

        // Simulate a realistic preferences payload (~50KB)
        let large_data = format!(
            r#"{{"preferences":{{"theme":"dark","urls":{}}},"synced_at":"2026-03-09T00:00:00Z"}}"#,
            serde_json::to_string(
                &(0..500)
                    .map(|i| format!("https://example-{i}.com/api/v1"))
                    .collect::<Vec<_>>()
            )
            .unwrap()
        );

        let put_resp = bucket
            .put_object_with_content_type(key, large_data.as_bytes(), "application/json")
            .await
            .expect("Large push should succeed");
        assert!(put_resp.status_code() < 300);

        let get_resp = bucket
            .get_object(key)
            .await
            .expect("Large pull should succeed");
        let body = String::from_utf8(get_resp.to_vec()).unwrap();
        assert_eq!(body, large_data);

        // Cleanup
        let _ = bucket.delete_object(key).await;
    }
}
