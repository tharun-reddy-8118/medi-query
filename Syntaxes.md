# The Ultimate Guide to Calculated Fields Syntax

Welcome to the definitive reference for creating Custom Calculated Fields in MediQuery. 

Calculated fields evaluate **row-by-row** across your entire dataset using the powerful **DuckDB SQL Engine**. This guide covers everything from basic syntax rules to advanced string, date, and math manipulations, complete with real-world examples.

---

## 1. Core Principles & Syntax Rules

Before writing any formula, you must understand the basic grammar of DuckDB SQL:

### The "Quotes" Rule
- **Double Quotes (`" "`)** are used strictly for **Column Names**. If your column has a space, capital letter, or special character, you *must* double-quote it.
  - ✅ Correct: `"Total Billed Amount"`
  - ❌ Incorrect: `Total Billed Amount` or `'Total Billed Amount'`
- **Single Quotes (`' '`)** are used strictly for **Text/String Values**.
  - ✅ Correct: `"Status" = 'Discharged'`
  - ❌ Incorrect: `"Status" = "Discharged"`

### Row-Level vs. Aggregation
Calculated fields compute a new value for *every single row* in your data. Because of this, **you cannot use aggregate functions** like `SUM()`, `AVG()`, `MIN()`, or `MAX()` inside a calculated field. 
- ❌ **Do not do this**: `AVG("Wait Time")` 
- ✅ **Do this**: Simply create the row-level value (e.g., `"Wait Time"`), save the calculated field, and then drag it into the Chart Builder where you can select `AVERAGE` from the aggregation dropdown.

---

## 2. Conditional Logic & Branching

### Advanced `CASE WHEN`
The `CASE` statement is your primary tool for categorizing data (if/else logic). You can chain as many `WHEN` conditions as you like. They are evaluated from top to bottom.

```sql
CASE 
  WHEN "Age" < 0 THEN 'Invalid Data'
  WHEN "Age" BETWEEN 0 AND 12 THEN 'Child'
  WHEN "Age" BETWEEN 13 AND 17 THEN 'Teenager'
  WHEN "Age" BETWEEN 18 AND 64 THEN 'Adult'
  ELSE 'Senior'
END
```

### `IN` and `NOT IN` Lists
Check if a value belongs to a specific list of items. This is much cleaner than writing multiple `OR` statements.

```sql
CASE 
  WHEN "Department" IN ('Cardiology', 'Neurology', 'Oncology') THEN 'Specialized Care'
  WHEN "Department" NOT IN ('Emergency', 'Triage') THEN 'General Care'
  ELSE 'Urgent Care'
END
```

### Handling Missing Data (`NULL`)
Data is rarely perfect. Use these functions to gracefully handle blanks.

**`COALESCE`**: Returns the first value that isn't `NULL`. Use it to set a default fallback value.
```sql
-- If Discount is blank, treat it as 0
"Price" - COALESCE("Discount", 0)
```

**`NULLIF`**: Returns `NULL` if the two arguments are equal. This is critical for preventing "Divide by Zero" errors.
```sql
-- If 'Total Cases' is 0, it becomes NULL, preventing a crash.
"Successful Cases" / NULLIF("Total Cases", 0)
```

---

## 3. String & Text Mastery

### Combining Strings (Concatenation)
Use the double-pipe `||` to stitch text together.
```sql
"First Name" || ' ' || "Middle Initial" || '. ' || "Last Name"
```
*Pro-Tip: Use `CONCAT_WS(separator, string1, string2)` to safely combine text while automatically skipping `NULL` values:*
```sql
-- Automatically skips if Middle Name is NULL
CONCAT_WS(' ', "First Name", "Middle Name", "Last Name")
```

### Pattern Matching (`LIKE` and `ILIKE`)
Search for specific text patterns. Use `%` as a wildcard (represents any number of characters). `LIKE` is case-sensitive, `ILIKE` is case-insensitive.
```sql
CASE
  WHEN "Diagnosis Notes" ILIKE '%fever%' THEN 'Fever Indicated'
  ELSE 'No Fever'
END
```

### Regular Expressions (`REGEXP`)
For advanced text extraction and cleaning, regex is incredibly powerful.

**`REGEXP_REPLACE`**: Replace text matching a pattern.
```sql
-- Remove all numbers from a string (e.g., "Ward 14B" -> "Ward B")
regexp_replace("Location", '[0-9]', '', 'g')
```

**`REGEXP_EXTRACT`**: Pull specific patterns out of messy text.
```sql
-- Extract a 5-digit ZIP code from a messy address string
regexp_extract("Address", '[0-9]{5}')
```

### Trimming and Padding
Clean up messy spacing or enforce a specific text length.

**`TRIM` / `LTRIM` / `RTRIM`**: Removes whitespace.
```sql
TRIM("Messy User Input String")
```

**`LPAD` / `RPAD`**: Adds characters to the left or right until a specific length is reached.
```sql
-- Pad a zip code with leading zeros to ensure it is always 5 characters
LPAD("Zip Code", 5, '0')
```

---

## 4. Date & Time Masterclass

Dates are stored differently than plain text. DuckDB provides an enormous suite of tools for time-based analytics.

### Date Arithmetic (`date_diff`, `date_add`, `date_sub`)
Calculate the exact time elapsed between two events. Valid intervals include `'year'`, `'month'`, `'day'`, `'hour'`, `'minute'`, `'second'`.

```sql
-- Calculate Length of Stay in Days
date_diff('day', "Admission Date", "Discharge Date")

-- Calculate age in years based on birthdate
date_diff('year', "DOB", current_date)
```

Adding time to a date:
```sql
"Surgery Date" + INTERVAL 6 MONTH
"Checkin Time" - INTERVAL 15 MINUTE
```

### Extracting Date Components
Pull out specific pieces of a timestamp.

```sql
extract('year' FROM "Date")         -- Returns 2024
extract('month' FROM "Date")        -- Returns 10
extract('day' FROM "Date")          -- Returns 15
extract('isodow' FROM "Date")       -- Returns Day of Week (1 = Monday, 7 = Sunday)
```

### Date Bucketing / Truncating (`date_trunc`)
Rounds a date down to the beginning of the specified interval. Excellent for creating cohort groups.
```sql
-- Converts '2024-10-15' into '2024-10-01'
date_trunc('month', "Admission Date")
```

### Parsing and Formatting Strings to Dates
If your date is accidentally loaded as text (e.g., `'15/10/2024'`), you can parse it using `strptime`.
```sql
strptime("Messy Text Date", '%d/%m/%Y')
```

---

## 5. Mathematical Functions

Standard operators (`+`, `-`, `*`, `/`) are supported. Furthermore, you have access to advanced mathematical functions.

### Modulo and Integer Division
```sql
"Total Minutes" // 60    -- Integer division: Returns whole hours
"Total Minutes" % 60     -- Modulo: Returns remaining minutes
```

### Rounding & Truncating
```sql
ROUND("Cost", 2)         -- Rounds to 2 decimal places (e.g., 10.456 -> 10.46)
CEIL("Cost")             -- Always rounds UP (e.g., 10.1 -> 11.0)
FLOOR("Cost")            -- Always rounds DOWN (e.g., 10.9 -> 10.0)
```

### Greatest & Least
Find the maximum or minimum value across multiple columns for a *single row* (unlike `MAX()` which looks across multiple rows).
```sql
GREATEST("Jan Revenue", "Feb Revenue", "Mar Revenue")
```

---

## 6. Type Casting (`CAST` and `TRY_CAST`)

Sometimes you need to treat text as a number, or a number as text.

**`CAST`**: Forces a conversion. Will crash if the conversion fails (e.g., trying to cast "Apple" to a number).
```sql
CAST("Zip Code" AS VARCHAR)
CAST("String Price" AS DOUBLE)
```

**`TRY_CAST`**: Safe conversion. If the conversion fails, it returns `NULL` instead of crashing your dataset. **Highly recommended for messy data.**
```sql
TRY_CAST("Messy String Numbers" AS DOUBLE)
```

---

## 7. Real-World Practical Examples

### Example 1: Creating a "Weekend Admission" Flag
You want to analyze if patients admitted on weekends have different outcomes. (Note: `isodow` returns 6 for Saturday, 7 for Sunday).
```sql
CASE
  WHEN extract('isodow' FROM "Admission Date") IN (6, 7) THEN 'Weekend'
  ELSE 'Weekday'
END
```

### Example 2: Complex Tiering Logic
Combining mathematical functions with `CASE WHEN` to create an intelligent priority score.
```sql
CASE
  WHEN "Severity Score" > 8 AND date_diff('hour', "Admit Time", current_timestamp) > 12 THEN 'Critical Priority'
  WHEN "Severity Score" > 5 THEN 'High Priority'
  ELSE 'Standard Care'
END
```

### Example 3: Formatting Durations as 'Xd Yh Zm'
Taking a duration in seconds and formatting it nicely for a text label.
```sql
CAST("Seconds" // 86400 AS VARCHAR) || 'd ' ||
CAST(("Seconds" % 86400) // 3600 AS VARCHAR) || 'h ' ||
CAST(("Seconds" % 3600) // 60 AS VARCHAR) || 'm'
```
