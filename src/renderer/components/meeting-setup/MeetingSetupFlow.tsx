import React, { useEffect } from 'react';
import { useMeetingSetupStore } from '../../stores/meeting-setup.store';
import { useSession } from '../../hooks/useSession';
import { trpc } from '../../api/trpc';
import { InfoStep } from './InfoStep';
import { QuestionsStep } from './QuestionsStep';
import { ChecklistStep } from './ChecklistStep';

interface MeetingSetupFlowProps {
  onCancel: () => void;
}

/**
 * Generate a default meeting name based on current time
 * Format: "Meeting at 10:30 AM"
 */
function generateDefaultMeetingName(): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `Meeting at ${timeStr}`;
}

export function MeetingSetupFlow({ onCancel }: MeetingSetupFlowProps) {
  const {
    step,
    name,
    description,
    questions,
    checklist,
    isGenerating,
    error,
    setStep,
    setInfo,
    setQuestions,
    setQuestionAnswer,
    setChecklist,
    setIsGenerating,
    setError,
    getMeetingSetupData,
    reset,
  } = useMeetingSetupStore();

  const { startRecording, isStarting } = useSession();

  const generateQuestionsMutation = trpc.meetingSetup.generateProbingQuestions.useMutation();
  const generateChecklistMutation = trpc.meetingSetup.generateChecklist.useMutation();

  // Start at 'info' step since sources are already selected in HomeView
  useEffect(() => {
    setStep('info');
  }, [setStep]);

  // Skip setup and start recording immediately with a generic name
  const handleSkipAndRecord = async () => {
    const defaultName = generateDefaultMeetingName();

    // Reset any partial setup data and set only the name
    reset();
    setInfo(defaultName, '');

    // Start recording with minimal data (just the name)
    await startRecording({
      name: defaultName,
      description: '',
      questions: [],
      checklist: [],
    });
  };

  const handleInfoNext = async (newName: string, newDescription: string) => {
    setInfo(newName, newDescription);
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateQuestionsMutation.mutateAsync({
        name: newName,
        description: newDescription,
      });

      if (result.success && result.questions.length > 0) {
        setQuestions(result.questions);
        setStep('questions');
      } else {
        setError(result.error || 'Failed to generate questions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuestionsBack = () => {
    setStep('info');
  };

  const handleQuestionsNext = async (answeredQuestions: typeof questions) => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateChecklistMutation.mutateAsync({
        name,
        description,
        questions: answeredQuestions,
      });

      if (result.success && result.checklist.length > 0) {
        setChecklist(result.checklist);
        setStep('checklist');
      } else {
        setError(result.error || 'Failed to generate checklist');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate checklist');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChecklistBack = () => {
    setStep('questions');
  };

  const handleStartRecording = async () => {
    // Get the meeting setup data to pass to the recording
    const setupData = getMeetingSetupData();

    // Start the recording with meeting setup data
    await startRecording(setupData);
  };

  const isSkipping = isStarting && !isGenerating;

  return (
    <div className="h-full w-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* Main content */}
      <div className="w-full max-w-[480px] px-6 relative z-10">
        {error && (
          <div className="mb-6 p-[16px] bg-[#fff5f5] border border-[#ffdfdf] rounded-[12px] flex items-start gap-[12px]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mt-0.5">
              <circle cx="10" cy="10" r="8" stroke="#dc2626" strokeWidth="1.5" />
              <path d="M10 6v5M10 13.5v.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-[13px] text-[#dc2626] leading-[20px]">{error}</p>
          </div>
        )}

        {step === 'info' && (
          <InfoStep
            initialName={name}
            initialDescription={description}
            isGenerating={isGenerating}
            isSkipping={isSkipping}
            onBack={onCancel}
            onNext={handleInfoNext}
            onSkip={handleSkipAndRecord}
          />
        )}

        {step === 'questions' && (
          <QuestionsStep
            questions={questions}
            isGenerating={isGenerating}
            isSkipping={isSkipping}
            onBack={handleQuestionsBack}
            onNext={handleQuestionsNext}
            onAnswerChange={setQuestionAnswer}
            onSkip={handleSkipAndRecord}
          />
        )}

        {step === 'checklist' && (
          <ChecklistStep
            name={name}
            description={description}
            checklist={checklist}
            isStarting={isStarting}
            isSkipping={isSkipping}
            onBack={handleChecklistBack}
            onStart={handleStartRecording}
            onSkip={handleSkipAndRecord}
          />
        )}
      </div>
    </div>
  );
}
