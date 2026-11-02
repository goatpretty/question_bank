import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AdminSettings from '../admin/AdminSettings'
import { metaService } from '../../services/metaService'
import { systemSettingsService } from '../../services/systemSettingsService'

jest.mock('../../services/metaService', () => ({
  metaService: { getMeta: jest.fn() },
}))

jest.mock('../../services/systemSettingsService', () => ({
  systemSettingsService: {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    resetSection: jest.fn(),
    sendTestEmail: jest.fn(),
    testAi: jest.fn(),
  },
}))

const getMeta = metaService.getMeta as jest.Mock
const getSettings = systemSettingsService.getSettings as jest.Mock
const updateSettings = systemSettingsService.updateSettings as jest.Mock
const resetSection = systemSettingsService.resetSection as jest.Mock
const sendTestEmail = systemSettingsService.sendTestEmail as jest.Mock
const testAi = systemSettingsService.testAi as jest.Mock

const settingsResponse = {
  success: true,
  data: {
    smtp: {
      enabled: true,
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      user: 'mailer',
      from: 'noreply@example.com',
      source: 'database',
      hasPassword: true,
    },
    ai: {
      enabled: false,
      baseUrl: 'https://api.example.com/v1',
      model: 'demo-model',
      source: 'environment',
      hasApiKey: true,
    },
  },
}

const metaResponse = {
  success: true,
  data: {
    name: 'question-bank',
    version: '0.1.0',
    registrationEnabled: true,
    aiEnabled: false,
    database: 'SQLite',
    license: 'MIT',
    dataLicense: 'CC BY 4.0',
    repository: 'https://github.com/goatpretty/question_bank',
  },
}

const renderSettings = async () => {
  render(<AdminSettings />)
  await screen.findByLabelText('服务器地址')
}

describe('AdminSettings Page', () => {
  beforeEach(() => {
    getMeta.mockReset().mockResolvedValue(metaResponse)
    getSettings.mockReset().mockResolvedValue(settingsResponse)
    updateSettings.mockReset().mockResolvedValue(settingsResponse)
    resetSection.mockReset().mockResolvedValue(settingsResponse)
    sendTestEmail.mockReset().mockResolvedValue({
      success: true,
      message: '测试邮件已发送，请检查收件箱。',
    })
    testAi.mockReset().mockResolvedValue({ success: true, message: 'AI 连接成功。' })
    window.confirm = jest.fn(() => true)
  })

  it('renders SMTP and AI configuration with their sources', async () => {
    await renderSettings()

    expect(screen.getByText('SMTP 邮件服务')).toBeInTheDocument()
    expect(screen.getByText('AI 学习助手')).toBeInTheDocument()
    expect(screen.getByText('数据库配置')).toBeInTheDocument()
    expect(screen.getByText('环境变量配置')).toBeInTheDocument()
    expect(screen.getByLabelText('服务器地址')).toHaveValue('smtp.example.com')
    expect(screen.getByLabelText('Base URL')).toHaveValue('https://api.example.com/v1')
  })

  it('never echoes saved secrets and only sends a new password', async () => {
    await renderSettings()

    const passwordInput = screen.getByLabelText('密码 / 授权码')
    expect(passwordInput).toHaveValue('')
    expect(passwordInput).toHaveAttribute('placeholder', '已保存，留空保持不变')

    fireEvent.click(screen.getByRole('button', { name: '保存 SMTP 设置' }))

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1))
    expect(updateSettings).toHaveBeenCalledWith({
      smtp: {
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        user: 'mailer',
        from: 'noreply@example.com',
      },
    })
  })

  it('sends a test email and shows the result', async () => {
    await renderSettings()

    fireEvent.click(screen.getByRole('button', { name: '发送测试邮件' }))

    await waitFor(() => expect(sendTestEmail).toHaveBeenCalledWith(undefined))
    expect(await screen.findByText('测试邮件已发送，请检查收件箱。')).toBeInTheDocument()
  })

  it('tests the AI connection and shows the result', async () => {
    await renderSettings()

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))

    await waitFor(() => expect(testAi).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('AI 连接成功。')).toBeInTheDocument()
  })

  it('resets a section back to environment variables after confirmation', async () => {
    await renderSettings()

    fireEvent.click(screen.getAllByRole('button', { name: '恢复 .env 配置' })[0])

    await waitFor(() => expect(resetSection).toHaveBeenCalledWith('smtp'))
    expect(window.confirm).toHaveBeenCalledTimes(1)
  })
})
