# import logging

# from sqlalchemy import create_engine, inspect, text
# from sqlalchemy.orm import declarative_base, sessionmaker

# logger = logging.getLogger("database")

# from .config import settings

# _db_url = settings.resolved_database_url
# _dialect_name = getattr(_db_url, "get_backend_name", None)
# _dialect = _dialect_name() if _dialect_name else str(_db_url).split(":", 1)[0].split("+")[0]
# _is_sqlite = _dialect == "sqlite"
# _is_mssql = _dialect == "mssql"
# connect_args = {"check_same_thread": False} if _is_sqlite else {}

# # Phase 8: connection pooling / resiliency. SQLite ignores pool_size and
# # max_overflow (single-file, no real connection pool), but pool_pre_ping
# # is harmless there and prevents "stale connection" errors against a
# # real database (e.g. Postgres or SQL Server) in production.
# engine_kwargs = {"connect_args": connect_args, "pool_pre_ping": True}
# if not _is_sqlite:
#     engine_kwargs.update(
#         pool_size=settings.db_pool_size,
#         max_overflow=settings.db_max_overflow,
#         pool_timeout=settings.db_pool_timeout_seconds,
#     )
# if _is_mssql:
#     # Batches executemany() calls (bulk inserts/updates) into fewer
#     # round-trips via pyodbc — pure performance, no behavior change.
#     engine_kwargs["fast_executemany"] = True

# engine = create_engine(_db_url, **engine_kwargs)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base = declarative_base()


# def get_db():
#     """
#     Request-scoped DB session. On any exception raised while the
#     request is being handled, the session is rolled back before it's
#     closed — this prevents a failed request from leaving a dangling
#     transaction / dirty session state that could corrupt a later query
#     reusing the same connection from the pool.
#     """
#     db = SessionLocal()
#     try:
#         yield db
#     except Exception:
#         db.rollback()
#         raise
#     finally:
#         db.close()


# def sync_missing_columns(base=Base, bind=engine):
#     """
#     Additive, non-destructive schema patch for tables that already exist.

#     `Base.metadata.create_all()` only creates tables that are missing
#     entirely — it never alters a table that's already there, even if the
#     ORM model has since grown new columns. On this install, `models.py`
#     had picked up several new columns (e.g. CallLog.appointment_id,
#     Appointment.doctor_id) that were never applied to the existing
#     medvoice.db file, so any query that selects a full ORM row (which
#     lists every mapped column) fails with "no such column".

#     This walks each table already present in the DB, compares it against
#     the current model definition, and issues `ALTER TABLE ... ADD COLUMN`
#     for anything missing. All such columns in this codebase are nullable
#     (or have only client-side/Python defaults), so this is safe to run
#     against existing data — no rows are touched, nothing is dropped or
#     renamed, and it's a no-op once columns are in sync. This keeps the
#     project on SQLite; it does not migrate to a different database.
#     """
#     inspector = inspect(bind)
#     existing_tables = set(inspector.get_table_names())
#     preparer = bind.dialect.identifier_preparer
#     # T-SQL syntax is `ALTER TABLE t ADD col type` (no COLUMN keyword);
#     # SQLite/Postgres use `ALTER TABLE t ADD COLUMN col type`.
#     add_kw = "ADD" if bind.dialect.name == "mssql" else "ADD COLUMN"

#     with bind.begin() as conn:
#         for table in base.metadata.sorted_tables:
#             if table.name not in existing_tables:
#                 continue  # brand-new table — create_all() already handled it

#             existing_cols = {col["name"] for col in inspector.get_columns(table.name)}
#             for column in table.columns:
#                 if column.name in existing_cols:
#                     continue
#                 col_type = column.type.compile(dialect=bind.dialect)
#                 table_ident = preparer.quote(table.name)
#                 col_ident = preparer.quote(column.name)
#                 ddl = f"ALTER TABLE {table_ident} {add_kw} {col_ident} {col_type}"
#                 conn.execute(text(ddl))
#                 logger.warning(
#                     f"schema sync: added missing column {table.name}.{column.name} ({col_type})"
#                 )




















import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

logger = logging.getLogger("database")


# ============================================================
# SQL SERVER ONLY
# ============================================================

DATABASE_URL = settings.resolved_database_url


# ============================================================
# ENGINE CONFIGURATION
# ============================================================

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout_seconds,
    fast_executemany=True,
)


# ============================================================
# SESSION
# ============================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ============================================================
# BASE MODEL
# ============================================================

Base = declarative_base()


# ============================================================
# DATABASE DEPENDENCY
# ============================================================

def get_db():
    """
    Request-scoped SQL Server database session.

    Rolls back the current transaction if an exception occurs,
    then always closes the session.
    """

    db = SessionLocal()

    try:
        yield db

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# ============================================================
# SQL SERVER SCHEMA SYNC
# ============================================================

def sync_missing_columns(base=Base, bind=engine):
    """
    Add missing nullable columns to existing SQL Server tables.

    This is an additive schema synchronization helper.

    It:
      - does NOT delete tables
      - does NOT delete data
      - does NOT rename columns
      - does NOT modify existing columns
      - only adds missing columns

    SQL Server only.
    """

    inspector = inspect(bind)

    existing_tables = set(
        inspector.get_table_names()
    )

    preparer = bind.dialect.identifier_preparer

    with bind.begin() as conn:

        for table in base.metadata.sorted_tables:

            # Table does not exist yet.
            # create_all() handles brand-new tables.
            if table.name not in existing_tables:
                continue

            existing_columns = {
                column["name"]
                for column in inspector.get_columns(table.name)
            }

            for column in table.columns:

                if column.name in existing_columns:
                    continue

                column_type = column.type.compile(
                    dialect=bind.dialect
                )

                table_identifier = preparer.quote(
                    table.name
                )

                column_identifier = preparer.quote(
                    column.name
                )

                # SQL Server syntax:
                #
                # ALTER TABLE table
                # ADD column datatype
                ddl = (
                    f"ALTER TABLE "
                    f"{table_identifier} "
                    f"ADD "
                    f"{column_identifier} "
                    f"{column_type}"
                )

                conn.execute(text(ddl))

                logger.warning(
                    "schema sync: added missing column "
                    f"{table.name}.{column.name} "
                    f"({column_type})"
                )