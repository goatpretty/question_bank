import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('should not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        <div>Modal Content</div>
      </Modal>
    );
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    const closeButton = screen.getByRole('button', { name: /关闭模态框/i });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay is clicked', () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    const overlay = screen.getByRole('dialog').parentElement;
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when modal content is clicked', () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    const content = screen.getByText('Modal Content');
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should call onClose when Escape key is pressed', () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should render footer when provided', () => {
    render(
      <Modal 
        isOpen={true} 
        onClose={() => {}} 
        title="Test Modal"
        footer={<button>Submit</button>}
      >
        <div>Modal Content</div>
      </Modal>
    );
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('should render different sizes correctly', () => {
    render(
      <Modal 
        isOpen={true} 
        onClose={() => {}} 
        title="Test Modal"
        size="sm"
      >
        <div>Small Modal</div>
      </Modal>
    );
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveClass('max-w-sm');
  });

  it('should render centered by default', () => {
    render(
      <Modal 
        isOpen={true} 
        onClose={() => {}} 
        title="Test Modal"
      >
        <div>Centered Modal</div>
      </Modal>
    );
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveClass('my-auto');
  });

  it('should not close when closeOnOverlayClick is false', () => {
    const onClose = jest.fn();
    render(
      <Modal 
        isOpen={true} 
        onClose={onClose} 
        title="Test Modal"
        closeOnOverlayClick={false}
      >
        <div>Modal Content</div>
      </Modal>
    );
    const overlay = screen.getByRole('dialog').parentElement;
    fireEvent.click(overlay!);
    expect(onClose).not.toHaveBeenCalled();
  });
});
