#!/usr/bin/env python3
"""
Generates src/lib/supabase/database.types.ts from a live PostgreSQL database.

Why this exists: the project prefers `supabase gen types typescript`, but that
needs the Supabase CLI and a linked project. This script does the same job
against any PostgreSQL instance, so the types can be regenerated in CI and in
the local test harness without a Supabase account.

Usage (from the repo root, with all migrations already applied):

    python3 scripts/generate-types.py "postgresql://postgres:postgres@localhost:5432/dokan_bondhu_test"

    # or point it at a database with DATABASE_URL
    DATABASE_URL="postgresql://..." python3 scripts/generate-types.py

`npm run db:types` runs it with no argument, so it falls back to DATABASE_URL
(or to the standard PG* variables through psql).

It shells out to `psql`, so no Python dependencies are needed.
"""

from __future__ import annotations

import collections
import os
import subprocess
import sys

PSQL = os.environ.get("PSQL_BIN", "psql")
OUT = os.path.join("src", "lib", "supabase", "database.types.ts")
SEP = "\x1f"

TABLES_SQL = f"""
select c.relname, a.attname, t.typname, a.attnotnull, a.atthasdef, a.attgenerated,
       coalesce((select string_agg(enumlabel, ',' order by enumsortorder)
                 from pg_enum e where e.enumtypid = t.oid), '')
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_type t on t.oid = a.atttypid
where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
order by c.relname, a.attnum;
"""

VIEWS_SQL = f"""
select c.relname, a.attname, t.typname,
       coalesce((select string_agg(enumlabel, ',' order by enumsortorder)
                 from pg_enum e where e.enumtypid = t.oid), '')
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_type t on t.oid = a.atttypid
where n.nspname = 'public' and c.relkind = 'v' and a.attnum > 0 and not a.attisdropped
order by c.relname, a.attnum;
"""

# Return types come from pg_get_function_result, because information_schema
# reports a composite return type only as "USER-DEFINED" with no name.
# Argument details come from information_schema.parameters, whose `specific_name`
# is the stable key linking the two (it is not the regprocedure text).
FUNCTIONS_SQL = """
select r.specific_name, r.routine_name
from information_schema.routines r
where r.routine_schema = 'public' and r.routine_type = 'FUNCTION'
order by r.routine_name, r.specific_name;
"""

RESULTS_SQL = """
select p.proname, pg_get_function_result(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by p.proname;
"""

PARAMS_SQL = """
select p.specific_name, p.parameter_name, p.data_type,
       coalesce(p.udt_name, ''),
       case when p.parameter_default is null then 'f' else 't' end,
       p.parameter_mode
from information_schema.parameters p
where p.specific_schema = 'public'
order by p.specific_name, p.ordinal_position;
"""

RELATIONSHIPS_SQL = """
select con.conrelid::regclass::text,
       con.conname,
       (select string_agg(a.attname, ',' order by u.ord)
          from unnest(con.conkey) with ordinality u(attnum, ord)
          join pg_attribute a on a.attrelid = con.conrelid and a.attnum = u.attnum),
       con.confrelid::regclass::text,
       (select string_agg(a.attname, ',' order by u.ord)
          from unnest(con.confkey) with ordinality u(attnum, ord)
          join pg_attribute a on a.attrelid = con.confrelid and a.attnum = u.attnum)
from pg_constraint con
join pg_namespace n on n.oid = con.connamespace
where n.nspname = 'public' and con.contype = 'f'
order by 1, 2;
"""

ENUMS_SQL = """
select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder)
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
group by t.typname
order by t.typname;
"""


def run(dsn: str, sql: str, width: int = 7) -> list[list[str]]:
    proc = subprocess.run(
        [PSQL, "-d", dsn, "-At", "-F", SEP, "-c", sql],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        sys.exit(f"psql failed: {proc.stderr.strip()}")
    out = proc.stdout.strip("\n")
    if not out:
        return []
    rows = []
    for line in out.split("\n"):
        parts = line.split(SEP)
        while len(parts) < width:
            parts.append("")
        rows.append([p.strip() for p in parts[:width]])
    return rows


def ts_type(pg_type: str, enum_name: str = "") -> str:
    base = pg_type.split("(")[0].strip()
    if base in (
        "uuid",
        "text",
        "timestamptz",
        "timestamp with time zone",
        "timestamp without time zone",
        "date",
        "time",
        "time without time zone",
        "timetz",
        "char",
        "bpchar",
        "varchar",
        "character varying",
        "character",
    ):
        return "string"
    if base in (
        "int2",
        "int4",
        "int8",
        "integer",
        "smallint",
        "bigint",
        "numeric",
        "float4",
        "float8",
        "double precision",
        "real",
    ):
        return "number"
    if base in ("bool", "boolean"):
        return "boolean"
    if base in ("json", "jsonb"):
        return "Json"
    if base == "tsvector":
        return "unknown"
    if enum_name:
        return f'Database["public"]["Enums"]["{enum_name}"]'
    return "unknown"


def parse_table_return(result: str) -> list[tuple[str, str]] | None:
    """`TABLE(id uuid, stock numeric)` → [("id", "uuid"), ("stock", "numeric")]."""
    if not result.startswith("TABLE("):
        return None
    inner = result[len("TABLE("):].rstrip(")")
    columns: list[tuple[str, str]] = []
    depth = 0
    current = ""
    parts: list[str] = []
    for char in inner:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += char
    parts.append(current)
    for part in parts:
        name, _, pg_type = part.strip().partition(" ")
        if name and pg_type:
            columns.append((name, pg_type.strip()))
    return columns or None


def return_type(result: str, enums: dict | None = None) -> str:
    table_columns = parse_table_return(result)
    if table_columns:
        enums = enums or {}
        fields = []
        for name, pg_type in table_columns:
            bare = pg_type.split(".")[-1].split("(")[0].strip()
            enum_name = bare if bare in enums else ""
            fields.append(f"{name}: {ts_type(pg_type, enum_name)} | null;")
        return "{ " + " ".join(fields) + " }"
    if result.startswith("SETOF"):
        return "Json"
    if result in ("json", "jsonb"):
        return "Json"
    if result in ("bigint", "integer", "smallint", "numeric", "double precision"):
        return "number"
    if result == "boolean":
        return "boolean"
    if result == "void":
        return "undefined"
    if result.startswith("public."):
        table = result.split(".", 1)[1]
        return f'Database["public"]["Tables"]["{table}"]["Row"]'
    if result in ("uuid", "text"):
        return "string"
    return "Json"


def main() -> None:
    if len(sys.argv) < 2 and not os.environ.get("DATABASE_URL"):
        sys.exit("usage: generate-types.py <postgres-dsn>")
    dsn = sys.argv[1] if len(sys.argv) > 1 else os.environ["DATABASE_URL"]

    tables: dict[str, list[list[str]]] = collections.OrderedDict()
    for rel, att, typ, notnull, hasdef, generated, labels in run(dsn, TABLES_SQL, 7):
        tables.setdefault(rel, []).append([att, typ, notnull, hasdef, generated, labels])

    views: dict[str, list[list[str]]] = collections.OrderedDict()
    for rel, att, typ, labels in run(dsn, VIEWS_SQL, 4):
        views.setdefault(rel, []).append([att, typ, labels])

    enums = {name: labels.split(",") for name, labels in run(dsn, ENUMS_SQL, 2)}

    # Foreign keys become `Relationships`, which is what lets PostgREST-style
    # embedded selects (`tenants!inner(name)`) be typed.
    relationships: dict[str, list[list[str]]] = collections.defaultdict(list)
    for table, fk_name, cols, ref_table, ref_cols in run(dsn, RELATIONSHIPS_SQL, 5):
        relationships[table].append([fk_name, cols, ref_table, ref_cols])

    # Functions + their arguments. information_schema is used instead of pg_proc
    # so argument names and defaults arrive already parsed.
    results = {name: result.strip() for name, result in run(dsn, RESULTS_SQL, 2)}

    params_by_func: dict[str, list[tuple[str, str, bool]]] = collections.defaultdict(list)
    for specific, name, dtype, udt_name, has_default, mode in run(dsn, PARAMS_SQL, 6):
        if mode not in ("IN", "INOUT"):
            continue
        arg_type = dtype
        if dtype == "USER-DEFINED" and udt_name:
            arg_type = udt_name
        params_by_func[specific].append((name, arg_type, has_default == "t"))

    functions = []
    for specific, routine_name in run(dsn, FUNCTIONS_SQL, 2):
        functions.append(
            (routine_name, specific, results.get(routine_name, "json"), params_by_func.get(specific, []))
        )

    lines: list[str] = []
    add = lines.append

    add("/**")
    add(" * Database types for the Supabase schema in `supabase/migrations`.")
    add(" *")
    add(" * GENERATED FILE — do not edit by hand. Regenerate with:")
    add(" *")
    add(" *     python3 scripts/generate-types.py <postgres-dsn>")
    add(" *")
    add(" * or, with the Supabase CLI linked to a project:")
    add(" *")
    add(" *     npm run db:types")
    add(" *")
    add(" * Generated columns (totals, invoice number, search vector) appear in Row")
    add(" * only: the client can never write them.")
    add(" */")
    add("")
    add("export type Json =")
    add("  | string")
    add("  | number")
    add("  | boolean")
    add("  | null")
    add("  | { [key: string]: Json | undefined }")
    add("  | Json[];")
    add("")
    add("export type Database = {")
    add("  public: {")
    add("    Tables: {")

    for table, cols in tables.items():
        row, insert, update = [], [], []
        for att, typ, notnull, hasdef, generated, labels in cols:
            t = ts_type(typ, typ if labels else "")
            nullable = notnull != "t"
            null_suffix = " | null" if nullable else ""
            row.append(f"        {att}: {t}{null_suffix};")
            if generated:
                continue
            if notnull == "t" and hasdef != "t":
                insert.append(f"        {att}: {t};")
            else:
                insert.append(f"        {att}?: {t}{null_suffix};")
            update.append(f"        {att}?: {t}{null_suffix};")

        add(f"      {table}: {{")
        add("        Row: {")
        lines.extend(row)
        add("        };")
        add("        Insert: {")
        lines.extend(insert)
        add("        };")
        add("        Update: {")
        lines.extend(update)
        add("        };")
        rels = relationships.get(table, [])
        if rels:
            add("        Relationships: [")
            for fk_name, cols, ref_table, ref_cols in rels:
                add("          {")
                add(f'            foreignKeyName: "{fk_name}";')
                add("            columns: [" + ", ".join(f'"{c}"' for c in cols.split(",")) + "];")
                add(f'            isOneToOne: false;')
                add(f'            referencedRelation: "{ref_table}";')
                add("            referencedColumns: [" + ", ".join(f'"{c}"' for c in ref_cols.split(",")) + "];")
                add("          },")
            add("        ];")
        else:
            add("        Relationships: [];")
        add("      };")

    add("    };")
    add("    Views: {")
    for view, cols in views.items():
        add(f"      {view}: {{")
        add("        Row: {")
        for att, typ, labels in cols:
            add(f"        {att}: {ts_type(typ, typ if labels else '')};")
        add("        };")
        # supabase-js requires Relationships on views as well as tables; without
        # it the whole schema fails its generic constraint and every query type
        # silently collapses to `never`.
        add("        Relationships: [];")
        add("      };")
    add("    };")
    add("    Functions: {")

    seen: set[str] = set()
    for name, _specific, result, args in functions:
        if name in seen:
            continue
        seen.add(name)

        rendered = []
        for arg_name, arg_type, optional in args:
            if not arg_name:
                continue
            ts = (
                "string"
                if arg_type in ("text", "uuid", "character varying", "date")
                else "number"
                if arg_type in ("bigint", "integer", "smallint", "numeric", "double precision")
                else "boolean"
                if arg_type == "boolean"
                else "Json"
            )
            if arg_type in enums:
                ts = f'Database["public"]["Enums"]["{arg_type}"]'
            rendered.append(f"          {arg_name}{'?' if optional else ''}: {ts};")

        table_columns = parse_table_return(result)
        plain = result.split(".", 1)[1] if "." in result else result

        if table_columns:
            fields = []
            for column_name, pg_type in table_columns:
                bare = pg_type.split(".")[-1].split("(")[0].strip()
                enum_name = bare if bare in enums else ""
                fields.append(f"{column_name}: {ts_type(pg_type, enum_name)} | null;")
            # RETURNS TABLE is set-returning: PostgREST hands back an array.
            returns = "{ " + " ".join(fields) + " }[]"
        elif plain in tables:
            returns = f'Database["public"]["Tables"]["{plain}"]["Row"]'
        elif result in ("json", "jsonb", "TABLE", "record"):
            returns = "Json"
        elif result in ("bigint", "integer", "smallint", "numeric"):
            returns = "number"
        elif result == "boolean":
            returns = "boolean"
        elif result == "void":
            returns = "undefined"
        elif result in ("uuid", "text", "date"):
            returns = "string"
        else:
            returns = "Json"

        add(f"      {name}: {{")
        if rendered:
            add("        Args: {")
            lines.extend(rendered)
            add("        };")
        else:
            add("        Args: Record<string, never>;")
        add(f"        Returns: {returns};")
        add("      };")

    add("    };")
    add("    Enums: {")
    for name, labels in enums.items():
        add("      " + name + ": " + " | ".join(f"'{l}'" for l in labels) + ";")
    add("    };")
    add("    CompositeTypes: Record<string, never>;")
    add("  };")
    add("};")

    with open(OUT, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")

    print(f"wrote {OUT}: {len(tables)} tables, {len(views)} views, {len(seen)} functions, {len(enums)} enums")


if __name__ == "__main__":
    main()
