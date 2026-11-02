import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Settings from '../Settings'
import { userService } from '../../services/userService'
import { accountService } from '../../services/accountService'

const mockUpdateUser = jest.fn()
const mockUpdateSession = jest.fn()
let mockAuthState: Record<string, unknown>

jest.mock('../../stores/auth', () => ({
  useAuthStore: () => mockAuthState,
}))

jest.mock('../../services/userService', () => ({
  userService: { getProfile: jest.fn() },
}))

jest.mock('../../services/accountService', () => ({
  accountService: {
    changePassword: jest.fn(),
    uploadAvatar: jest.fn(),
    removeAvatar: jest.fn(),
  },
}))

const getProfile = userService.getProfile as jest.Mock
const changePassword = accountService.changePassword as jest.Mock

const baseUser = {
  id: 'u1',
  username: 'student1',
  email: 'student@example.com',
  role: 'student',
  avatar: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  needPasswordChange: false,
}

const renderSettings = () => render(
  <MemoryRouter>
    <Settings />
  </MemoryRouter>,
)

describe('Settings Page', () => {
  beforeEach(() => {
    mockAuthState = {
      user: baseUser,
      token: 'token-1',
      updateUser: mockUpdateUser,
      updateSession: mockUpdateSession,
    }
    mockUpdateUser.mockReset()
    mockUpdateSession.mockReset()
    getProfile.mockReset().mockResolvedValue({
      success: true,
      data: {
        stats: { totalWrongQuestions: 42, masteredWrongQuestions: 30, masteryRate: 71.4 },
      },
    })
    changePassword.mockReset()
  })

  it('merges profile, password and learning stats into one page', async () => {
    renderSettings()

    expect(screen.getByText('个人资料')).toBeInTheDocument()
    expect(screen.getByText('修改密码')).toBeInTheDocument()
    expect(screen.getByText('学习统计')).toBeInTheDocument()
    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('71%')).toBeInTheDocument()
    expect(screen.getByText('查看错题本')).toBeInTheDocument()
  })

  it('shows username and email as read-only account information', async () => {
    renderSettings()

    expect(screen.getByLabelText('用户名')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('邮箱')).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: '保存用户名' })).not.toBeInTheDocument()
    expect(screen.getByText('用户名与邮箱暂不支持自助修改，如有需要请联系管理员。')).toBeInTheDocument()
    await screen.findByText('42')
  })

  it('rejects mismatched new passwords before calling the API', async () => {
    renderSettings()

    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'oldpass1' } })
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'newpass1' } })
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'different1' } })
    fireEvent.click(screen.getByRole('button', { name: '更新密码' }))

    expect(await screen.findByText('两次输入的新密码不一致。')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('changes the password with the current password and refreshes the session', async () => {
    const updatedUser = { ...baseUser, tokenVersion: undefined }
    changePassword.mockResolvedValue({
      success: true,
      token: 'token-2',
      user: updatedUser,
      message: '密码更新成功。',
    })

    renderSettings()

    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'oldpass1' } })
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'newpass1' } })
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'newpass1' } })
    fireEvent.click(screen.getByRole('button', { name: '更新密码' }))

    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('oldpass1', 'newpass1'))
    expect(mockUpdateSession).toHaveBeenCalledWith('token-2', updatedUser)
    expect(await screen.findByText('密码更新成功。')).toBeInTheDocument()
  })

  it('rejects an avatar larger than 2MB before opening the cropper', async () => {
    renderSettings()

    const file = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 + 1 })

    fireEvent.change(screen.getByTestId('avatar-input'), { target: { files: [file] } })

    expect(await screen.findByText(/图片不能超过 2MB/)).toBeInTheDocument()
    expect(screen.queryByText('裁剪头像')).not.toBeInTheDocument()
  })
})
