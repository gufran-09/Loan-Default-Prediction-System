"""
RDS Migration Runner
Applies SQL migration scripts from scripts/migrations/ to Amazon RDS PostgreSQL.
Tracks applied migrations in a _migrations metadata table to prevent re-execution.

Usage:
    python scripts/migrate_rds.py

Requires:
    - DATABASE_URL environment variable (or .env file)
    - psycopg2 or pg8000 Python package
"""

import os
import sys
import glob
import datetime

def load_env():
    """Load .env file if present"""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())

def get_connection():
    """Create database connection using DATABASE_URL"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is not set.")
        print("Set it in .env or export it: export DATABASE_URL=postgresql://user:pass@host:5432/dbname")
        sys.exit(1)

    try:
        import psycopg2
        conn = psycopg2.connect(database_url, sslmode='require')
        conn.autocommit = False
        return conn, 'psycopg2'
    except ImportError:
        pass

    try:
        import pg8000
        # Parse connection string
        from urllib.parse import urlparse
        parsed = urlparse(database_url)
        conn = pg8000.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            user=parsed.username,
            password=parsed.password,
            database=parsed.path.lstrip('/'),
            ssl_context=True
        )
        conn.autocommit = False
        return conn, 'pg8000'
    except ImportError:
        pass

    print("ERROR: No PostgreSQL driver found. Install one:")
    print("  pip install psycopg2-binary")
    print("  or")
    print("  pip install pg8000")
    sys.exit(1)

def ensure_migrations_table(cursor):
    """Create the _migrations tracking table if it doesn't exist"""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS _migrations (
            id SERIAL PRIMARY KEY,
            filename TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            checksum TEXT
        )
    """)

def get_applied_migrations(cursor):
    """Get list of already applied migration filenames"""
    cursor.execute("SELECT filename FROM _migrations ORDER BY filename")
    return {row[0] for row in cursor.fetchall()}

def compute_checksum(filepath):
    """Simple checksum for migration file content"""
    import hashlib
    with open(filepath, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

def main():
    load_env()

    # Find migration files
    migrations_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'migrations')
    if not os.path.exists(migrations_dir):
        print(f"ERROR: Migrations directory not found: {migrations_dir}")
        sys.exit(1)

    migration_files = sorted(glob.glob(os.path.join(migrations_dir, '*.sql')))
    if not migration_files:
        print("No migration files found in scripts/migrations/")
        return

    print(f"Found {len(migration_files)} migration file(s)")
    print(f"Connecting to RDS...")

    conn, driver = get_connection()
    cursor = conn.cursor()

    try:
        # Ensure tracking table exists
        ensure_migrations_table(cursor)
        conn.commit()

        # Get already applied migrations
        applied = get_applied_migrations(cursor)
        print(f"Already applied: {len(applied)} migration(s)")

        # Apply pending migrations
        pending = [(f, os.path.basename(f)) for f in migration_files if os.path.basename(f) not in applied]

        if not pending:
            print("All migrations are up to date.")
            return

        print(f"\nApplying {len(pending)} pending migration(s):\n")

        for filepath, filename in pending:
            print(f"  → Applying: {filename} ...", end=" ")
            with open(filepath, 'r') as f:
                sql = f.read()

            try:
                cursor.execute(sql)
                checksum = compute_checksum(filepath)
                cursor.execute(
                    "INSERT INTO _migrations (filename, checksum) VALUES (%s, %s)",
                    (filename, checksum)
                )
                conn.commit()
                print("✓ OK")
            except Exception as e:
                conn.rollback()
                print(f"✗ FAILED")
                print(f"    Error: {e}")
                print(f"\n  Migration stopped. Fix the error and re-run.")
                sys.exit(1)

        print(f"\n✓ All {len(pending)} migration(s) applied successfully to Amazon RDS.")

    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
