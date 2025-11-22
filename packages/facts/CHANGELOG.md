# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-22

### Added

- Zod integration for robust data validation.
- Enhanced error handling for more reliable operations.
- Fact parsing from untrusted sources in SQLite.
- Automatic database migration for the facts table.
- `initialize` method for querying from stored facts.
- Comprehensive test suite to ensure 100% code coverage.
- New badges for code coverage and other metrics.

### Changed

- Reworked the `findFromLast` algorithm to reduce time and space complexity.
- Renamed `findFromSnapshot` to `findFromLast` for clarity.
- Renamed the `accepted` callback to `stop`.
- Simplified the fact shape for a better developer experience.
- Improved documentation with segmented sections for better readability.

### Fixed

- Corrected miscellaneous broken links and typos.
- Resolved an issue with a missing fact in the match option.

## [0.1.0] - 2025-11-17

### Added

- Initial release of the `@aminnairi/facts` package.
