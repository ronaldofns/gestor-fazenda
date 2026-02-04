import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Modal from './Modal';

describe('Modal', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('não renderiza nada quando open é false', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <div>Conteúdo do modal</div>
      </Modal>
    );
    expect(screen.queryByText('Conteúdo do modal')).not.toBeInTheDocument();
  });

  it('renderiza filhos quando open é true', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <div>Conteúdo do modal</div>
      </Modal>
    );
    expect(screen.getByText('Conteúdo do modal')).toBeInTheDocument();
  });

  it('aplica overflow hidden no body quando aberto', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <div>Conteúdo</div>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
  });
});
