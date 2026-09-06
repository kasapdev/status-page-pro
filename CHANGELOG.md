# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.1] - 2026-09-06

### Fixed

- Admin panel icon-only buttons ("Simulate 90-day history" dice icon, "Post update" chat icon, "Resolve incident" check icon) now have proper `aria-label` attributes in addition to their `title` tooltips, matching the existing Edit/Delete buttons. Previously these controls relied on `title` alone, which is not reliably announced by screen readers, making them inaccessible to assistive-technology users.
