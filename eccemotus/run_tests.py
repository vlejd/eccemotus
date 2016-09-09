import sys
import unittest

# Change PYTHONPATH to include plaso.
#sys.path.insert(0, u'.')


if __name__ == '__main__':

  test_suite = unittest.TestLoader().discover('tests', pattern='*.py')
  test_results = unittest.TextTestRunner(verbosity=2).run(test_suite)
  if not test_results.wasSuccessful():
    sys.exit(1)

