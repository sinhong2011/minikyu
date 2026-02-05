use sqlx::sqlite::SqlitePool;

pub async fn run_migration(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    create_schema_versions_table(pool).await?;

    let applied_migrations = get_applied_migrations(pool).await?;

    if !applied_migrations.contains(&3) {
        apply_initial_schema(pool).await?;
        record_migration(pool, 3, "drop_users_table").await?;
    }

    if !applied_migrations.contains(&2) {
        apply_v2_schema(pool).await?;
        record_migration(pool, 2, "add_downloads_table").await?;
    }

    Ok(())
}
