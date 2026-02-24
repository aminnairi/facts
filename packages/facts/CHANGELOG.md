# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-02-24

### Added

- The user can now discriminate the type of the fact filtered for more precise queries.
- TypeScript linting for the source code to improve code quality.

### Changed

- Stricter type checking for improved type safety.

### Fixed

- Updated and fixed some documentation instructions.
- Now awaiting deletion of the SQLite file tested for more reliable tests.
- Fixed missing type annotations for imported types.

## [2.0.0] - 2025-11-27

- `register` method is now renamed to `registerQuery`
- New `Command` interface for creating single actions
- New `MemoryCommand` implementation of the `Command` interface
- New method for registering commands: `registerCommand`
- Property `stream.identifier` is now `streamIdentifier` for better inference
- Property `stream.name` is now `streamName` for better inference
- Removed the `stream` property from facts

## [1.1.0] - 2025-11-23

### Added

- JSDoc comments for better library overall documentation.

### Fixed

- Fixed TSX not being able to import the module as it was not a module

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

## [1.0.1] - 2025-11-23

### Fixed

- Updated the paths for the examples.

## [0.1.0] - 2025-11-17

### Added

- Initial release of the `@aminnairi/facts` package.
