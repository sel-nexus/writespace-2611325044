/** Verify the pure caller-defined display contract and optional decoration. */
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard.jsx';

it('displays descriptive text with the supplied color and hidden optional icon', () => {
  render(
    <StatCard
      label="Recent local activity"
      value="A saved note"
      icon={<svg data-testid="decoration" />}
      color="border-indigo-200 bg-indigo-50"
    />,
  );
  expect(screen.getByText('Recent local activity').tagName).toBe('DT');
  expect(screen.getByText('A saved note').tagName).toBe('DD');
  expect(screen.getByText('A saved note').closest('dl')).toHaveClass('border-indigo-200', 'bg-indigo-50');
  expect(screen.getByTestId('decoration').parentElement).toHaveAttribute('aria-hidden', 'true');
});

it.each([undefined, null])('renders a numeric zero and default color without optional icon %s', (icon) => {
  const { container } = render(<StatCard label="Caller-defined value" value={0} icon={icon} />);
  expect(screen.getByText('0')).toBeInTheDocument();
  expect(container.querySelector('[aria-hidden]')).toBeNull();
  expect(container.querySelector('dl')).toHaveClass('border-violet-200', 'bg-violet-50');
});

it('rerenders supplied values safely in StrictMode without reading or mutating storage', () => {
  const read = vi.spyOn(Storage.prototype, 'getItem');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const view = render(
    <StrictMode>
      <StatCard label="Recent local activity" value="No posts yet" />
    </StrictMode>,
  );
  view.rerender(
    <StrictMode>
      <StatCard label="Recent local activity" value="<script>not markup</script>" />
    </StrictMode>,
  );
  expect(screen.getByText('<script>not markup</script>')).toBeInTheDocument();
  expect(view.container.querySelector('script')).toBeNull();
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
